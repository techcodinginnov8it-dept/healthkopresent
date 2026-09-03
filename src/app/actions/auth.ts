"use server";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { clearPatientSession, createPatientSession } from "@/lib/auth/patient-session";
import { clearDoctorSession, createDoctorSession } from "@/lib/auth/doctor-session";
import { clearAdminSession, createAdminSession } from "@/lib/auth/admin-session";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

type PatientSignupPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  email: string;
  countryCode: string;
  phone: string;
  dob: string;
  gender?: string;
  password: string;
  hipaaConsent: boolean;
};

type PatientLoginPayload = {
  email: string;
  password: string;
};

type OtpPurpose = "signup_verify" | "login_verify";

type PatientOtpResponse = {
  success: boolean;
  requiresOtp?: boolean;
  purpose?: OtpPurpose;
  email?: string;
  message?: string;
  error?: string;
  delivery?: "email" | "dev";
  debugOtp?: string;
};

export type DoctorLoginPayload = {
  identifier?: string;
  emailOrNpi?: string; // backwards compatibility
  password: string;
  securityKey?: string;
};

async function sendPatientSupabaseOtp({
  email,
  purpose,
  firstName,
}: {
  email: string;
  purpose: OtpPurpose;
  firstName?: string;
}) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        first_name: firstName,
        otp_purpose: purpose,
      },
    },
  });

  if (error) {
    throw new Error(error.message || "Supabase could not send the verification code.");
  }
}

// Dev-mode OTP fallback (in-memory, non-production only)
const devOtpStore = new Map<string, { otp: string; purpose: OtpPurpose; expiresAt: number }>();

function generateDevOtp() {
  return randomInt(100000, 1000000).toString();
}

async function issueEmailOtp({
  email,
  purpose,
  firstName,
}: {
  email: string;
  purpose: OtpPurpose;
  firstName?: string;
}) {
  try {
    await sendPatientSupabaseOtp({ email, purpose, firstName });
    return { delivery: "email" as const };
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    const debugOtp = generateDevOtp();
    devOtpStore.set(`${email}:${purpose}`, { otp: debugOtp, purpose, expiresAt: Date.now() + 10 * 60 * 1000 });
    console.warn("[issueEmailOtp] Falling back to dev OTP store:", error);
    return { delivery: "dev" as const, debugOtp };
  }
}

async function verifySupabaseEmailOtp(email: string, otp: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Incorrect verification code.");
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const verificationTypes: ("magiclink" | "signup" | "email")[] = ["magiclink", "signup", "email"];
  let lastError: unknown = null;

  for (const type of verificationTypes) {
    try {
      console.log(`[verifySupabaseEmailOtp] Attempting OTP verification for ${email} with type '${type}'`);
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type,
      });

      if (!error) {
        console.log(`[verifySupabaseEmailOtp] OTP verification succeeded for ${email} with type '${type}'`);
        return;
      }

      console.warn(`[verifySupabaseEmailOtp] OTP verification failed with type '${type}':`, error.message);
      lastError = error;
    } catch (err: unknown) {
      console.error(`[verifySupabaseEmailOtp] Exception during OTP verification with type '${type}':`, err);
      lastError = err;
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Incorrect verification code.";
  throw new Error(message);
}

async function verifyPatientOtpCode(email: string, otp: string, purpose: OtpPurpose) {
  // In non-production: check dev OTP store first
  if (process.env.NODE_ENV !== "production") {
    const key = `${email}:${purpose}`;
    const stored = devOtpStore.get(key);
    if (stored && stored.otp === otp && stored.expiresAt > Date.now()) {
      devOtpStore.delete(key);
      return { delivery: "dev" as const };
    }
  }

  await verifySupabaseEmailOtp(email, otp);
  return { delivery: "email" as const };
}

function isOtpWorkflowEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_OTP === "true";
}

/**
 * Step 1 of patient signup: create the account and email an OTP.
 */
export async function requestPatientSignupOtp(data: PatientSignupPayload): Promise<PatientOtpResponse> {
  const { firstName, middleName, lastName, suffix, email, countryCode, phone, dob, gender, password, hipaaConsent } = data;

  if (!firstName || !lastName || !email || !phone || !dob || !password) {
    return { success: false, error: "Missing required fields" };
  }

  const existingPatient = await prisma.patient.findUnique({ where: { email } });
  if (existingPatient) {
    return { success: false, error: "A patient with this email already exists" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username: email },
    create: { username: email, password: hashedPassword, role: "PATIENT" },
    update: { password: hashedPassword },
  });

  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      firstName,
      middleName: middleName || null,
      lastName,
      suffix: suffix || null,
      email,
      countryCode,
      phone,
      dob,
      gender: gender || null,
      password: hashedPassword,
      hipaaConsent,
      emailVerified: false,
    }
  });

  if (!isOtpWorkflowEnabled()) {
    await prisma.patient.update({
      where: { email },
      data: { emailVerified: true },
    });

    await createPatientSession({ userId: patient.id, email: patient.email });

    return {
      success: true,
      requiresOtp: false,
      email: patient.email,
      message: "Your account is ready. Redirecting to your dashboard.",
    };
  }

  try {
    const otpDelivery = await issueEmailOtp({
      email: patient.email,
      purpose: "signup_verify",
      firstName: patient.firstName,
    });

    return {
      success: true,
      requiresOtp: true,
      purpose: "signup_verify",
      email: patient.email,
      message: "We sent a 6-digit code to your email to finish setting up your patient account.",
      delivery: otpDelivery.delivery,
      debugOtp: otpDelivery.debugOtp,
    };
  } catch (otpError: unknown) {
    console.error("OTP send failed. Rolling back patient record...", otpError);
    await prisma.patient.delete({ where: { email } }).catch((e) =>
      console.error("Failed to delete patient during signup rollback:", e)
    );

    return {
      success: false,
      error: otpError instanceof Error ? otpError.message : "We could not send the verification code. Please try again."
    };
  }
}

/**
 * Step 2 of patient signup: verify OTP and start the patient session.
 */
export async function verifyPatientSignupOtp(data: {
  email: string;
  otp: string;
}): Promise<PatientOtpResponse> {
  const { email, otp } = data;

  if (!email || !otp || otp.length !== 6) {
    return { success: false, error: "A valid 6-digit verification code is required." };
  }

  const patient = await prisma.patient.findUnique({ where: { email } });
  if (!patient) {
    return { success: false, error: "We could not find that patient account." };
  }

  try {
    await verifyPatientOtpCode(email, otp, "signup_verify");
  } catch {
    return { success: false, error: "We could not verify your email." };
  }

  await prisma.patient.update({ where: { email }, data: { emailVerified: true } });
  await createPatientSession({ userId: patient.id, email: patient.email });

  return {
    success: true,
    email: patient.email,
    message: "Your email has been verified and your dashboard is ready.",
  };
}

/**
 * Step 1 of patient login: validate password and email an OTP.
 */
export async function requestPatientLoginOtp(data: PatientLoginPayload): Promise<PatientOtpResponse> {
  const { email, password } = data;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  const patient = await prisma.patient.findUnique({ where: { email } });
  if (!patient) {
    return { success: false, error: "Invalid email or password" };
  }

  const isMatch = await bcrypt.compare(password, patient.password);
  if (!isMatch) {
    return { success: false, error: "Invalid email or password" };
  }

  try {
    const purpose: OtpPurpose = patient.emailVerified ? "login_verify" : "signup_verify";

    const otpDelivery = await issueEmailOtp({
      email: patient.email,
      purpose,
      firstName: patient.firstName,
    });

    const message = patient.emailVerified
      ? "We sent a 6-digit code to your email to confirm this sign-in."
      : "Your account still needs email verification. We sent you a fresh 6-digit code.";

    return {
      success: true,
      requiresOtp: true,
      purpose,
      email: patient.email,
      message,
      delivery: otpDelivery.delivery,
      debugOtp: otpDelivery.debugOtp,
    };
  } catch (otpError: unknown) {
    console.error("Login OTP send failed:", otpError);
    return {
      success: false,
      error: otpError instanceof Error ? otpError.message : "We could not send the verification code. Please try again."
    };
  }
}

/**
 * Step 2 of patient login: verify OTP and start the patient session.
 */
export async function verifyPatientLoginOtp(data: {
  email: string;
  otp: string;
  purpose?: OtpPurpose;
}): Promise<PatientOtpResponse> {
  const { email, otp, purpose = "login_verify" } = data;

  if (!email || !otp || otp.length !== 6) {
    return { success: false, error: "A valid 6-digit verification code is required." };
  }

  const patient = await prisma.patient.findUnique({ where: { email } });
  if (!patient) {
    return { success: false, error: "We could not find that patient account." };
  }

  try {
    await verifyPatientOtpCode(email, otp, purpose);
  } catch {
    return { success: false, error: "Authentication failed" };
  }

  if (purpose === "signup_verify" && !patient.emailVerified) {
    await prisma.patient.update({ where: { email }, data: { emailVerified: true } });
  }

  await createPatientSession({ userId: patient.id, email: patient.email });

  return {
    success: true,
    email: patient.email,
    message: "Your identity has been confirmed. Redirecting to your dashboard.",
  };
}

export async function logoutPatient() {
  await clearPatientSession();
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Supabase signOut failed:", err);
  }
  redirect("/signin");
}

export async function registerPatient(data: PatientSignupPayload) {
  return requestPatientSignupOtp(data);
}

export async function loginPatient(data: PatientLoginPayload) {
  const email = data.email?.trim().toLowerCase();
  const { password } = data;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  const patient = await prisma.patient.findUnique({ where: { email } });
  if (!patient) {
    return { success: false, error: "Invalid email or password" };
  }

  const isMatch = await bcrypt.compare(password, patient.password);
  if (!isMatch) {
    return { success: false, error: "Invalid email or password" };
  }

  await createPatientSession({ userId: patient.id, email: patient.email });

  return {
    success: true,
    email: patient.email,
    message: "Welcome back. Redirecting to your dashboard.",
  };
}

/**
 * Authenticate doctor credentials (Username or License Number)
 * Email login is deliberately removed so email changes do not affect login credentials.
 */
export async function loginDoctor(data: DoctorLoginPayload) {
  const rawIdentifier = (data.identifier || data.emailOrNpi || "").trim();
  const { password, securityKey } = data;

  console.log("[loginDoctor] Attempt with identifier:", rawIdentifier ? "[PROVIDED]" : "[MISSING]");

  if (!rawIdentifier || !password) {
    return { success: false, error: "Username/License Number and password are required" };
  }

  if (rawIdentifier.includes("@")) {
    return {
      success: false,
      error: "Email login is no longer supported for physicians. Please use your admin-assigned Username or License Number.",
    };
  }

  try {
    const doctor = await prisma.doctor.findFirst({
      where: {
        OR: [
          { username: { equals: rawIdentifier, mode: "insensitive" } },
          { user: { username: { equals: rawIdentifier, mode: "insensitive" } } },
          { licenseNumber: { equals: rawIdentifier, mode: "insensitive" } },
          { npi: { equals: rawIdentifier, mode: "insensitive" } },
        ],
      },
      include: {
        user: true,
      },
    });

    console.log("[loginDoctor] Prisma lookup result:", doctor ? { id: doctor.id, username: doctor.username, userUsername: doctor.user?.username, license: doctor.licenseNumber } : "NOT FOUND");

    if (!doctor) {
      return { success: false, error: "No physician matches this username or license number" };
    }

    // Keep doctor.username and user.username in sync if edited directly in Supabase
    if (doctor.user?.username && doctor.username !== doctor.user.username) {
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: { username: doctor.user.username },
      }).catch((err) => console.warn("Auto-sync doctor.username failed:", err));
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    console.log("[loginDoctor] bcrypt.compare result:", isMatch);

    if (!isMatch) {
      return { success: false, error: "Invalid credentials" };
    }

    if (securityKey && securityKey.length !== 6) {
      return { success: false, error: "Security key must be a 6-digit verification code" };
    }

    await createDoctorSession({ userId: doctor.id, email: doctor.email });

    return {
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        username: (doctor as any).username ?? doctor.licenseNumber,
        email: doctor.email,
        specialty: doctor.specialty,
      },
    };
  } catch (error: unknown) {
    console.error("loginDoctor failed:", error);
    return { success: false, error: "Credentials lookup failed" };
  }
}

export async function logoutDoctor() {
  await clearDoctorSession();
  redirect("/doctor/signin");
}

const ADMIN_EMAIL = "admin@healthko.com";
const ADMIN_PASSWORD_HASH = "$2a$10$A24WIxraPyqrS6dfZaps0OnP11alyc7ZO0E5CC2LdQgemuzwdvtwm";

export async function loginAdmin(data: { email: string; password: string }) {
  const normalizedEmail = data.email?.trim().toLowerCase();
  const password = data.password ?? "";

  if (!normalizedEmail || !password) {
    return { success: false, error: "Email and password are required" };
  }

  if (normalizedEmail !== ADMIN_EMAIL.toLowerCase()) {
    return { success: false, error: "Invalid admin credentials" };
  }

  // Try DB lookup first
  try {
    const dbUsers: any = await prisma.$queryRawUnsafe(
      `SELECT * FROM "users" WHERE LOWER(username) = $1 LIMIT 1`,
      normalizedEmail
    );
    if (Array.isArray(dbUsers) && dbUsers.length > 0) {
      const user = dbUsers[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        await createAdminSession({ userId: user.id, email: user.username || normalizedEmail });
        return {
          success: true,
          admin: { id: user.id, email: user.username || normalizedEmail, role: user.role ?? "admin" },
        };
      }
    }
  } catch (dbErr) {
    console.warn("DB lookup for admin failed, falling back to static hash check:", dbErr);
  }

  const isMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!isMatch) {
    return { success: false, error: "Invalid admin credentials" };
  }

  await createAdminSession({ userId: "admin", email: ADMIN_EMAIL });

  return {
    success: true,
    admin: { id: "admin", email: ADMIN_EMAIL, role: "admin" },
  };
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/signin");
}
