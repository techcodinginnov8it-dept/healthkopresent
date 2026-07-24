"use server";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { clearPatientSession, createPatientSession } from "@/lib/auth/patient-session";
import { clearDoctorSession, createDoctorSession } from "@/lib/auth/doctor-session";
import { clearAdminSession, createAdminSession } from "@/lib/auth/admin-session";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { mockDb } from "@/lib/mockDb";
import { cookies } from "next/headers";

const ADMIN_EMAIL = "admin@healthko.com";
const ADMIN_PASSWORD_HASH = "$2a$10$A24WIxraPyqrS6dfZaps0OnP11alyc7ZO0E5CC2LdQgemuzwdvtwm";

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

type DoctorLoginPayload = {
  emailOrNpi: string;
  password: string;
  securityKey?: string;
};

async function validateMockPatientLogin({ email, password }: PatientLoginPayload) {
  const patient = mockDb.findPatientByEmail(email);

  if (!patient) {
    return null;
  }

  const isMatch = await bcrypt.compare(password, patient.password);
  if (!isMatch) {
    return null;
  }

  return {
    email: patient.email,
    firstName: patient.firstName,
    emailVerified: patient.emailVerified,
  };
}

async function loginMockDoctor({ emailOrNpi, password, securityKey }: DoctorLoginPayload) {
  if (!emailOrNpi || !password) {
    return { success: false, error: "NPI/Email and password are required" };
  }

  const doctor = mockDb.findDoctorByEmailOrNpi(emailOrNpi);
  if (!doctor) {
    return { success: false, error: "No physician matches these credentials" };
  }

  const isMatch = await bcrypt.compare(password, doctor.password);
  if (!isMatch) {
    return { success: false, error: "Invalid credentials" };
  }

  if (securityKey && securityKey.length !== 6) {
    return { success: false, error: "Security key must be a 6-digit verification code" };
  }

  await createDoctorSession({
    userId: doctor.id,
    email: doctor.email,
  });

  return {
    success: true,
    doctor: {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      specialty: doctor.specialty,
    },
  };
}

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

function isLocalOtpFallbackEnabled() {
  return process.env.NODE_ENV !== "production";
}

function generateDevOtp() {
  return randomInt(100000, 1000000).toString();
}

function storeMockOtp(email: string, purpose: OtpPurpose, otp: string) {
  mockDb.createEmailOtp(email, otp, purpose, new Date(Date.now() + 10 * 60 * 1000));
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
    await sendPatientSupabaseOtp({
      email,
      purpose,
      firstName,
    });

    return { delivery: "email" as const };
  } catch (error: unknown) {
    if (!isLocalOtpFallbackEnabled()) {
      throw error;
    }

    const debugOtp = generateDevOtp();
    storeMockOtp(email, purpose, debugOtp);
    console.warn("[issueEmailOtp] Falling back to local mock OTP:", error);
    return { delivery: "dev" as const, debugOtp };
  }
}

function withOtpDeliveryHint(message: string) {
  return message;
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
  if (isLocalOtpFallbackEnabled()) {
    const latestOtp = mockDb.findLatestOtp(email, purpose);
    if (latestOtp && !latestOtp.used) {
      const expiresAt = new Date(latestOtp.expiresAt);
      if (latestOtp.otp === otp && expiresAt.getTime() > Date.now()) {
        mockDb.markOtpAsUsed(latestOtp.id);
        return { delivery: "dev" as const };
      }
    }
  }

  await verifySupabaseEmailOtp(email, otp);
  return { delivery: "email" as const };
}

function isOtpWorkflowEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_OTP === "true";
}

type PrismaPatientAccountInput = {
  id?: string;
  email: string;
  password: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  countryCode: string;
  phone: string;
  dob: string;
  gender?: string | null;
  hipaaConsent: boolean;
  emailVerified: boolean;
  isActive?: boolean;
};

type PrismaDoctorAccountInput = {
  id?: string;
  email: string;
  password: string;
  name: string;
  npi: string;
  specialty: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  isActive?: boolean;
  isVerified?: boolean;
  emailVerified: boolean;
};

async function ensurePrismaPatientAccount(tx: Prisma.TransactionClient, input: PrismaPatientAccountInput) {
  const user = await tx.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      password: input.password,
      role: "PATIENT",
      emailVerified: input.emailVerified,
      isActive: input.isActive ?? true,
    },
    update: {
      password: input.password,
      role: "PATIENT",
      emailVerified: input.emailVerified,
      isActive: input.isActive ?? true,
    },
  });

  const patient = await tx.patient.upsert({
    where: { email: input.email },
    create: {
      ...(input.id ? { id: input.id } : {}),
      userId: user.id,
      firstName: input.firstName,
      middleName: input.middleName ?? null,
      lastName: input.lastName,
      suffix: input.suffix ?? null,
      email: input.email,
      countryCode: input.countryCode,
      phone: input.phone,
      dob: input.dob,
      gender: input.gender ?? null,
      password: input.password,
      hipaaConsent: input.hipaaConsent,
      emailVerified: input.emailVerified,
      isActive: input.isActive ?? true,
    },
    update: {
      userId: user.id,
      firstName: input.firstName,
      middleName: input.middleName ?? null,
      lastName: input.lastName,
      suffix: input.suffix ?? null,
      countryCode: input.countryCode,
      phone: input.phone,
      dob: input.dob,
      gender: input.gender ?? null,
      password: input.password,
      hipaaConsent: input.hipaaConsent,
      emailVerified: input.emailVerified,
      isActive: input.isActive ?? true,
    },
  });

  return { user, patient };
}

async function ensurePrismaDoctorAccount(tx: Prisma.TransactionClient, input: PrismaDoctorAccountInput) {
  const user = await tx.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      password: input.password,
      role: "DOCTOR",
      emailVerified: input.emailVerified,
      isActive: input.isActive ?? true,
    },
    update: {
      password: input.password,
      role: "DOCTOR",
      emailVerified: input.emailVerified,
      isActive: input.isActive ?? true,
    },
  });

  const doctor = await tx.doctor.upsert({
    where: { email: input.email },
    create: {
      ...(input.id ? { id: input.id } : {}),
      userId: user.id,
      name: input.name,
      firstName: input.firstName ?? null,
      middleName: input.middleName ?? null,
      lastName: input.lastName ?? null,
      suffix: input.suffix ?? null,
      npi: input.npi,
      email: input.email,
      password: input.password,
      specialty: input.specialty,
      isActive: input.isActive ?? true,
      isVerified: input.isVerified ?? false,
    },
    update: {
      userId: user.id,
      name: input.name,
      firstName: input.firstName ?? null,
      middleName: input.middleName ?? null,
      lastName: input.lastName ?? null,
      suffix: input.suffix ?? null,
      password: input.password,
      specialty: input.specialty,
      isActive: input.isActive ?? true,
      isVerified: input.isVerified ?? false,
    },
  });

  return { user, doctor };
}

async function syncPrismaPatientAccount(email: string) {
  const patient = await prisma.patient.findUnique({
    where: { email },
    include: { user: true },
  });

  if (!patient) {
    return null;
  }

  if (!patient.user || patient.user.email !== patient.email || patient.user.password !== patient.password || patient.user.role !== "PATIENT") {
    const synced = await prisma.$transaction(async (tx: Prisma.TransactionClient) => ensurePrismaPatientAccount(tx, {
      id: patient.id,
      email: patient.email,
      password: patient.password,
      firstName: patient.firstName,
      middleName: patient.middleName,
      lastName: patient.lastName,
      suffix: patient.suffix,
      countryCode: patient.countryCode,
      phone: patient.phone,
      dob: patient.dob,
      gender: patient.gender,
      hipaaConsent: patient.hipaaConsent,
      emailVerified: patient.emailVerified,
      isActive: patient.isActive,
    }));

    return synced;
  }

  return { user: patient.user, patient };
}

async function syncPrismaDoctorAccount(emailOrNpi: string) {
  const doctor = await prisma.doctor.findFirst({
    where: {
      OR: [{ email: emailOrNpi }, { npi: emailOrNpi }],
    },
    include: { user: true },
  });

  if (!doctor) {
    return null;
  }

  if (!doctor.user || doctor.user.email !== doctor.email || doctor.user.password !== doctor.password || doctor.user.role !== "DOCTOR") {
    const synced = await prisma.$transaction(async (tx: Prisma.TransactionClient) => ensurePrismaDoctorAccount(tx, {
      id: doctor.id,
      email: doctor.email,
      password: doctor.password,
      name: doctor.name,
      npi: doctor.npi,
      specialty: doctor.specialty,
      firstName: doctor.firstName,
      middleName: doctor.middleName,
      lastName: doctor.lastName,
      suffix: doctor.suffix,
      isActive: doctor.isActive,
      isVerified: doctor.isVerified,
      emailVerified: true,
    }));

    return synced;
  }

  return { user: doctor.user, doctor };
}

/**
 * Step 1 of patient signup: create the account and email an OTP.
 */
export async function requestPatientSignupOtp(data: PatientSignupPayload): Promise<PatientOtpResponse> {
  const { firstName, middleName, lastName, suffix, email, countryCode, phone, dob, gender, password, hipaaConsent } = data;
  const normalizedEmail = email.trim().toLowerCase();

  if (!firstName || !lastName || !normalizedEmail || !phone || !dob || !password) {
    return { success: false, error: "Missing required fields" };
  }

  let createdPatient: { id: string; email: string; firstName: string } | null = null;
  let isMockDb = false;

  // Step 1: Create the patient record in either Prisma or Mock DB fallback
  try {
    const existingPatient = await prisma.patient.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingPatient) {
      return { success: false, error: "An account with this email already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const patientAccount = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const account = await ensurePrismaPatientAccount(tx, {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        middleName: middleName || null,
        lastName,
        suffix: suffix || null,
        countryCode,
        phone,
        dob,
        gender: gender || null,
        hipaaConsent,
        emailVerified: false,
        isActive: true,
      });

      return account.patient;
    });

    createdPatient = { id: patientAccount.id, email: patientAccount.email, firstName: patientAccount.firstName };
  } catch (error: unknown) {
    console.warn("Prisma signup failed, falling back to mock JSON database:", error);
    try {
      const existingPatient = mockDb.findPatientByEmail(normalizedEmail);
      if (existingPatient) {
        return { success: false, error: "A patient with this email already exists" };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const patient = mockDb.createPatient({
        firstName,
        middleName: middleName || null,
        lastName,
        suffix: suffix || null,
        email: normalizedEmail,
        countryCode,
        phone,
        dob,
        gender: gender || null,
        password: hashedPassword,
        hipaaConsent,
        emailVerified: false,
      });

      createdPatient = { id: patient.id, email: patient.email, firstName: patient.firstName };
      isMockDb = true;
    } catch (mockErr: unknown) {
      console.error("Signup Mock DB critical failure:", mockErr);
      return { success: false, error: "Failed to create patient account." };
    }
  }

  if (!isOtpWorkflowEnabled()) {
      if (isMockDb) {
        mockDb.updatePatient(createdPatient.email, { emailVerified: true });
      } else {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.patient.update({
            where: { email: createdPatient.email },
            data: { emailVerified: true },
          });
          await tx.user.update({
            where: { email: createdPatient.email },
            data: { emailVerified: true },
          });
        });
      }

      await createPatientSession({
        userId: createdPatient.id,
      email: createdPatient.email,
    });

    return {
      success: true,
      requiresOtp: false,
      email: createdPatient.email,
      message: "Your account is ready. Redirecting to your dashboard.",
    };
  }

  // Step 2: Attempt to send the verification OTP
  try {
    const otpDelivery = await issueEmailOtp({
      email: createdPatient.email,
      purpose: "signup_verify",
      firstName: createdPatient.firstName,
    });

    return {
      success: true,
      requiresOtp: true,
      purpose: "signup_verify",
      email: createdPatient.email,
      message: withOtpDeliveryHint("We sent a 6-digit code to your email to finish setting up your patient account."),
      delivery: otpDelivery.delivery,
      debugOtp: otpDelivery.debugOtp,
    };
  } catch (otpError: unknown) {
    console.error("Supabase OTP send failed. Rolling back patient record creation...", otpError);

    // Rollback DB creation so user is not left in a half-created/orphaned state!
    if (isMockDb) {
      mockDb.deletePatient(createdPatient.email);
    } else {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.patient.delete({
          where: { email: createdPatient.email },
        });
        await tx.user.delete({
          where: { email: createdPatient.email },
        });
      }).catch((dbDeleteErr: unknown) => {
        console.error("Failed to delete patient/user during signup rollback:", dbDeleteErr);
      });
    }

    // Return the informative error message (e.g. "email rate limit exceeded") so the user knows what actually failed!
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
  if (!isPrismaConfigured()) {
    try {
      const { email, otp } = data;

      if (!email || !otp || otp.length !== 6) {
        return { success: false, error: "A valid 6-digit verification code is required." };
      }

      const patient = mockDb.findPatientByEmail(email);

      if (!patient) {
        return { success: false, error: "We could not find that patient account." };
      }

      await verifyPatientOtpCode(email, otp, "signup_verify");
      mockDb.updatePatient(email, { emailVerified: true });

      await createPatientSession({
        userId: patient.id,
        email: patient.email,
      });

      return {
        success: true,
        email: patient.email,
        message: "Your email has been verified and your dashboard is ready.",
      };
    } catch (mockErr) {
      console.error("Signup verify Mock DB failure:", mockErr);
      return { success: false, error: "We could not verify your email." };
    }
  }

  try {
    const { email, otp } = data;
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !otp || otp.length !== 6) {
      return { success: false, error: "A valid 6-digit verification code is required." };
    }

    const patient = await prisma.patient.findUnique({
      where: { email: normalizedEmail },
    });

    if (!patient) {
      return { success: false, error: "We could not find that patient account." };
    }

    await verifyPatientOtpCode(normalizedEmail, otp, "signup_verify");

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.patient.update({
        where: { email: normalizedEmail },
        data: { emailVerified: true },
      });
      await tx.user.update({
        where: { email: normalizedEmail },
        data: { emailVerified: true },
      });
    });

    await createPatientSession({
      userId: patient.id,
      email: patient.email,
    });

    return {
      success: true,
      email: patient.email,
      message: "Your email has been verified and your dashboard is ready.",
    };
  } catch (error: unknown) {
    console.warn("Prisma signup verification failed, falling back to mock database:", error);
    try {
      const { email, otp } = data;
      const normalizedEmail = email.trim().toLowerCase();
      const patient = mockDb.findPatientByEmail(normalizedEmail);

      if (!patient) {
        return { success: false, error: "We could not find that patient account." };
      }

      await verifyPatientOtpCode(normalizedEmail, otp, "signup_verify");

      mockDb.updatePatient(normalizedEmail, { emailVerified: true });

      await createPatientSession({
        userId: patient.id,
        email: patient.email,
      });

      return {
        success: true,
        email: patient.email,
        message: "Your email has been verified and your dashboard is ready.",
      };
    } catch (mockErr) {
      console.error("Signup verify Mock DB failure:", mockErr);
      return { success: false, error: "We could not verify your email." };
    }
  }
}

/**
 * Step 1 of patient login: validate password and email an OTP.
 */
export async function requestPatientLoginOtp(data: PatientLoginPayload): Promise<PatientOtpResponse> {
  let validatedPatient: { email: string; firstName: string; emailVerified: boolean } | null = null;
  const normalizedEmail = data.email.trim().toLowerCase();
  const { password } = data;

  if (!normalizedEmail || !password) {
    return { success: false, error: "Email and password are required" };
  }

  // Step 1: Validate credentials using Prisma or Mock DB fallback
  if (!isPrismaConfigured()) {
    validatedPatient = await validateMockPatientLogin({ email: normalizedEmail, password });

    if (!validatedPatient) {
      return { success: false, error: "Invalid email or password" };
    }
  } else {
    try {
      const synced = await syncPrismaPatientAccount(normalizedEmail);

      if (!synced) {
        return { success: false, error: "Invalid email or password" };
      }

      const { patient } = synced;
      const isMatch = await bcrypt.compare(password, patient.password);
      if (!isMatch) {
        return { success: false, error: "Invalid email or password" };
      }

      validatedPatient = { email: patient.email, firstName: patient.firstName, emailVerified: patient.emailVerified };
    } catch (error: unknown) {
      console.warn("Prisma login request failed, falling back to mock database:", error);
      validatedPatient = await validateMockPatientLogin({ email: normalizedEmail, password });

      if (!validatedPatient) {
        return { success: false, error: "Invalid email or password" };
      }
    }
  }

  // Step 2: Attempt to send the verification OTP
  try {
    const purpose: OtpPurpose = validatedPatient.emailVerified ? "login_verify" : "signup_verify";

    const otpDelivery = await issueEmailOtp({
      email: validatedPatient.email,
      purpose,
      firstName: validatedPatient.firstName,
    });

    const message = validatedPatient.emailVerified
      ? "We sent a 6-digit code to your email to confirm this sign-in."
      : "Your account still needs email verification. We sent you a fresh 6-digit code.";

    return {
      success: true,
      requiresOtp: true,
      purpose,
      email: validatedPatient.email,
      message: withOtpDeliveryHint(message),
      delivery: otpDelivery.delivery,
      debugOtp: otpDelivery.debugOtp,
    };
  } catch (otpError: unknown) {
    console.error("Supabase login OTP send failed:", otpError);
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
  if (!isPrismaConfigured()) {
    try {
      const { email, otp, purpose = "login_verify" } = data;

      if (!email || !otp || otp.length !== 6) {
        return { success: false, error: "A valid 6-digit verification code is required." };
      }

      const patient = mockDb.findPatientByEmail(email);

      if (!patient) {
        return { success: false, error: "We could not find that patient account." };
      }

      await verifyPatientOtpCode(email, otp, purpose);

      if (purpose === "signup_verify" && !patient.emailVerified) {
        mockDb.updatePatient(email, { emailVerified: true });
      }

      await createPatientSession({
        userId: patient.id,
        email: patient.email,
      });

      return {
        success: true,
        email: patient.email,
        message: "Your identity has been confirmed. Redirecting to your dashboard.",
      };
    } catch (mockErr) {
      console.error("Login verification Mock DB failure:", mockErr);
      return { success: false, error: "Authentication failed" };
    }
  }

  try {
    const { email, otp, purpose = "login_verify" } = data;

    if (!email || !otp || otp.length !== 6) {
      return { success: false, error: "A valid 6-digit verification code is required." };
    }

    const patient = await prisma.patient.findUnique({
      where: { email },
    });

    if (!patient) {
      return { success: false, error: "We could not find that patient account." };
    }

    await verifyPatientOtpCode(email, otp, purpose);

    if (purpose === "signup_verify" && !patient.emailVerified) {
      await prisma.patient.update({
        where: { email },
        data: { emailVerified: true },
      });
    }

    await createPatientSession({
      userId: patient.id,
      email: patient.email,
    });

    return {
      success: true,
      email: patient.email,
      message: "Your identity has been confirmed. Redirecting to your dashboard.",
    };
  } catch (error: unknown) {
    console.warn("Prisma login verification failed, falling back to mock database:", error);
    try {
      const { email, otp, purpose = "login_verify" } = data;
      const patient = mockDb.findPatientByEmail(email);

      if (!patient) {
        return { success: false, error: "We could not find that patient account." };
      }

      await verifyPatientOtpCode(email, otp, purpose);

      if (purpose === "signup_verify" && !patient.emailVerified) {
        mockDb.updatePatient(email, { emailVerified: true });
      }

      await createPatientSession({
        userId: patient.id,
        email: patient.email,
      });

      return {
        success: true,
        email: patient.email,
        message: "Your identity has been confirmed. Redirecting to your dashboard.",
      };
    } catch (mockErr) {
      console.error("Login verification Mock DB failure:", mockErr);
      return { success: false, error: "Authentication failed" };
    }
  }
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

async function syncMockPatientToPrisma(email: string): Promise<string | null> {
  if (!isPrismaConfigured()) {
    return null;
  }
  try {
    const demoPatient = mockDb.findPatientByEmail(email);
    if (!demoPatient) {
      return null;
    }
    const pgPatient = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.upsert({
        where: { email: demoPatient.email.toLowerCase() },
        create: {
          email: demoPatient.email.toLowerCase(),
          password: demoPatient.password,
          role: "PATIENT",
          emailVerified: demoPatient.emailVerified,
          isActive: demoPatient.isActive,
        },
        update: {
          password: demoPatient.password,
          role: "PATIENT",
          emailVerified: demoPatient.emailVerified,
          isActive: demoPatient.isActive,
        },
      });

      return tx.patient.upsert({
        where: { email: demoPatient.email },
        create: {
          id: demoPatient.id,
          userId: user.id,
          firstName: demoPatient.firstName,
          middleName: demoPatient.middleName,
          lastName: demoPatient.lastName,
          suffix: demoPatient.suffix,
          email: demoPatient.email,
          countryCode: demoPatient.countryCode,
          phone: demoPatient.phone,
          dob: demoPatient.dob,
          gender: demoPatient.gender,
          password: demoPatient.password,
          hipaaConsent: demoPatient.hipaaConsent,
          emailVerified: demoPatient.emailVerified,
          isActive: demoPatient.isActive,
        },
        update: {
          userId: user.id,
          firstName: demoPatient.firstName,
          middleName: demoPatient.middleName,
          lastName: demoPatient.lastName,
          suffix: demoPatient.suffix,
          countryCode: demoPatient.countryCode,
          phone: demoPatient.phone,
          dob: demoPatient.dob,
          gender: demoPatient.gender,
          password: demoPatient.password,
          hipaaConsent: demoPatient.hipaaConsent,
          emailVerified: demoPatient.emailVerified,
          isActive: demoPatient.isActive,
        },
      });
    });
    console.log(`[syncMockPatientToPrisma] Synced mock patient "${email}" to Postgres.`);
    return pgPatient.id;
  } catch (err) {
    console.warn("[syncMockPatientToPrisma] Failed to sync mock patient to Prisma:", err);
    return null;
  }
}

export async function loginPatient(data: PatientLoginPayload) {
  const email = data.email.trim().toLowerCase();
  const { password } = data;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  try {
    // Try Prisma first if configured
    if (isPrismaConfigured()) {
      try {
        const synced = await syncPrismaPatientAccount(email);

        if (synced) {
          const { patient } = synced;
          const isMatch = await bcrypt.compare(password, patient.password);

          if (isMatch) {
            await createPatientSession({
              userId: patient.id,
              email: patient.email,
            });

            return {
              success: true,
              email: patient.email,
              message: "Welcome back. Redirecting to your dashboard.",
            };
          }
          console.warn(`[loginPatient] Password mismatch for ${email} in Prisma`);
        }
      } catch (prismaError) {
        console.warn("[loginPatient] Prisma lookup error:", prismaError);
      }
    }

    // Fallback to MockDB
    const demoPatient = mockDb.findPatientByEmail(email);

    if (!demoPatient) {
      console.warn(`[loginPatient] No patient found in MockDB for ${email}`);
      return { success: false, error: "Invalid email or password" };
    }

    const isMatch = await bcrypt.compare(password, demoPatient.password);

    if (!isMatch) {
      console.warn(`[loginPatient] Password mismatch for ${email} in MockDB`);
      return { success: false, error: "Invalid email or password" };
    }

    await createPatientSession({
      userId: demoPatient.id,
      email: demoPatient.email,
    });

    return {
      success: true,
      email: demoPatient.email,
      message: "Welcome back. Redirecting to your dashboard.",
    };
  } catch (error: unknown) {
    console.error("[loginPatient] Unexpected error:", error);
    return { success: false, error: "Invalid email or password" };
  }
}

/**
 * Authenticate doctor credentials (NPI or Email)
 */
export async function loginDoctor(data: DoctorLoginPayload) {
  try {
    const emailOrNpi = data.emailOrNpi.trim();
    const { password, securityKey } = data;

    console.log("[loginDoctor] Attempt:", { emailOrNpi, passwordLength: password?.length, isPrisma: isPrismaConfigured() });

    if (!emailOrNpi || !password) {
      return { success: false, error: "NPI/Email and password are required" };
    }

    if (!isPrismaConfigured()) {
      console.log("[loginDoctor] Using MOCK DB path");
      return loginMockDoctor(data);
    }

    const synced = await syncPrismaDoctorAccount(emailOrNpi);
    const doctor = synced?.doctor ?? null;

    console.log("[loginDoctor] Prisma lookup result:", doctor ? { id: doctor.id, email: doctor.email, hashPrefix: doctor.password.substring(0, 10) } : "NOT FOUND");

    if (!doctor) {
      return { success: false, error: "No physician matches these credentials" };
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    console.log("[loginDoctor] bcrypt.compare result:", isMatch, "| input password:", JSON.stringify(password));
    if (!isMatch) {
      return { success: false, error: "Invalid credentials" };
    }

    // Verify 6-digit passcode check
    if (securityKey && securityKey.length !== 6) {
      return { success: false, error: "Security key must be a 6-digit verification code" };
    }

    await createDoctorSession({
      userId: doctor.id,
      email: doctor.email,
    });

    return {
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty
      }
    };
  } catch (error: unknown) {
    console.warn("Prisma doctor login failed, falling back to mock database:", error);
    try {
      return await loginMockDoctor(data);
    } catch (mockErr) {
      console.error("Doctor login Mock DB failure:", mockErr);
      return { success: false, error: "Licensure lookup failed" };
    }
  }
}

export async function loginAdmin(data: { email: string; password: string }) {
  const normalizedEmail = data.email?.trim().toLowerCase();
  const password = data.password ?? "";
  let adminSessionId = "admin";

  if (!normalizedEmail || !password) {
    return { success: false, error: "Email and password are required" };
  }

  if (normalizedEmail !== ADMIN_EMAIL.toLowerCase()) {
    return { success: false, error: "Invalid admin credentials" };
  }

  if (isPrismaConfigured()) {
    try {
      const adminAccount = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.upsert({
          where: { email: normalizedEmail },
          create: {
            email: normalizedEmail,
            password: ADMIN_PASSWORD_HASH,
            role: "ADMIN",
            emailVerified: true,
            isActive: true,
          },
          update: {
            password: ADMIN_PASSWORD_HASH,
            role: "ADMIN",
            emailVerified: true,
            isActive: true,
          },
        });

        const admin = await tx.admin.upsert({
          where: { email: normalizedEmail },
          create: {
            userId: user.id,
            name: "System Administrator",
            email: normalizedEmail,
            role: "SUPER_ADMIN",
          },
          update: {
            userId: user.id,
            name: "System Administrator",
            role: "SUPER_ADMIN",
          },
        });

        return { user, admin };
      });

      adminSessionId = adminAccount.admin.id;
      const isMatch = await bcrypt.compare(password, adminAccount.user.password);
      if (!isMatch && !(await bcrypt.compare(password, ADMIN_PASSWORD_HASH))) {
        return { success: false, error: "Invalid admin credentials" };
      }
    } catch (dbErr) {
      console.warn("Prisma admin check failed, checking hardcoded secret hash:", dbErr);
      const isMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
      if (!isMatch) {
        return { success: false, error: "Invalid admin credentials" };
      }
    }
  } else {
    const isMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!isMatch) {
      return { success: false, error: "Invalid admin credentials" };
    }
  }

  await createAdminSession({
    userId: adminSessionId,
    email: normalizedEmail,
  });

  return {
    success: true,
    admin: {
      id: adminSessionId,
      email: normalizedEmail,
      role: "admin",
    },
  };
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/signin");
}

export async function logoutDoctor() {
  await clearDoctorSession();
  redirect("/doctor/signin");
}
