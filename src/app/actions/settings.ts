"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDoctorSession } from "@/lib/auth/doctor-session";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { generateOtp, storeOtp, verifyOtp } from "@/lib/otp-store";
import { sendOtpEmail } from "@/lib/mailer";

type ActionResult = {
  success: boolean;
  error?: string;
  targetEmail?: string;
};

type DoctorProfilePayload = {
  name: string;
  email: string;
  image?: string;
  specialty: string;
  availability: string;
  status?: string;
  licenseNumber?: string;
  licenseState?: string;
  bio?: string;
  consultFee?: string;
  yearsExp?: string;
  consultationDuration?: string;
  consultationDurationUnit?: string;
  phone?: string;
  otp?: string;
};

type PatientProfilePayload = {
  firstName: string;
  lastName: string;
  email: string;
  image?: string;
  countryCode: string;
  phone: string;
  dob: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  height?: string;
  weight?: string;
  bloodType?: string;
  allergies?: string;
  existingConditions?: string;
  currentMedications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
};

type PasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  otp: string;
};

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNumber(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseDuration(value?: string) {
  const parsed = parseOptionalNumber(value);
  if (!parsed) {
    return 30;
  }

  return Math.max(1, Math.round(parsed));
}

function normalizeDurationUnit(value?: string) {
  return value === "hours" ? "hours" : "minutes";
}

function normalizeDoctorStatus(value?: string) {
  return value === "BUSY" || value === "OFFLINE" ? value : "ONLINE";
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePasswordPayload(data: PasswordPayload) {
  if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
    return "Current password, new password, and confirmation are required.";
  }

  if (data.newPassword.length < 8) {
    return "New password must be at least 8 characters.";
  }

  if (data.newPassword !== data.confirmPassword) {
    return "New password and confirmation do not match.";
  }

  if (data.currentPassword === data.newPassword) {
    return "Choose a new password that is different from your current password.";
  }

  return "";
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

/**
 * Step 1: Generate a 6-digit OTP, store it server-side, and email it to the
 * currently signed-in doctor.  Called before the password change form is submitted.
 */
export async function requestDoctorPasswordOtp(): Promise<ActionResult> {
  try {
    const session = await requireDoctorSession();

    const doctor = await prisma.doctor.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });

    const email = doctor?.email ?? session.email;
    const name = doctor?.name ?? email;

    if (!email) {
      return { success: false, error: "No email address found for this doctor account." };
    }

    const otp = generateOtp("doctor", session.userId);
    await storeOtp("doctor", session.userId, otp);
    console.log(`[requestDoctorPasswordOtp] Generated OTP for doctor ${session.userId}, sending to ${email}...`);
    await sendOtpEmail({ to: email, otp, userName: name });

    return { success: true, targetEmail: email };
  } catch (err: any) {
    console.error("[requestDoctorPasswordOtp] failed:", err);
    return {
      success: false,
      error: err?.message ? `Failed to send code: ${err.message}` : "Could not send the verification code. Check your Gmail SMTP settings in .env.local.",
    };
  }
}

export async function requestPatientPasswordOtp(): Promise<ActionResult> {
  try {
    const session = await requirePatientSession();

    const patient = await prisma.patient.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const email = patient?.email ?? session.email;
    const name = patient ? `${patient.firstName} ${patient.lastName}`.trim() : email;

    if (!email) {
      return { success: false, error: "No email address found for this patient account." };
    }

    const otp = generateOtp("patient", session.userId);
    await storeOtp("patient", session.userId, otp);
    console.log(`[requestPatientPasswordOtp] Generated OTP for patient ${session.userId}, sending to ${email}...`);
    await sendOtpEmail({ to: email, otp, userName: name });

    return { success: true, targetEmail: email };
  } catch (err: any) {
    console.error("[requestPatientPasswordOtp] failed:", err);
    return {
      success: false,
      error: err?.message ? `Failed to send code: ${err.message}` : "Could not send the verification code. Check your Gmail SMTP settings in .env.local.",
    };
  }
}

export async function requestDoctorContactUpdateOtp(targetEmail: string): Promise<ActionResult & { debugOtp?: string; targetEmail?: string }> {
  try {
    const session = await requireDoctorSession();
    const cleanEmail = targetEmail.trim().toLowerCase();

    if (!cleanEmail || !validateEmail(cleanEmail)) {
      return { success: false, error: "Enter a valid email address." };
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });

    if (!doctor) {
      return { success: false, error: "Doctor account not found." };
    }

    if (cleanEmail !== doctor.email.toLowerCase()) {
      const existing = await prisma.doctor.findFirst({
        where: {
          email: cleanEmail,
          NOT: { id: session.userId },
        },
        select: { id: true },
      });
      if (existing) {
        return { success: false, error: "That email is already used by another doctor account." };
      }
    }

    const otp = generateOtp("doctor", session.userId);
    await storeOtp("doctor", session.userId, otp);
    console.log(`[requestDoctorContactUpdateOtp] Generated OTP for doctor ${session.userId}, sending to ${cleanEmail}...`);
    await sendOtpEmail({
      to: cleanEmail,
      otp,
      userName: doctor.name,
      purpose: "Contact Information Update",
    });

    return {
      success: true,
      targetEmail: cleanEmail,
      ...(process.env.NODE_ENV !== "production" ? { debugOtp: otp } : {}),
    };
  } catch (err: any) {
    console.error("[requestDoctorContactUpdateOtp] failed:", err);
    return {
      success: false,
      error: err?.message ? `Failed to send code: ${err.message}` : "Could not send the verification code. Check your Gmail SMTP settings in .env.local.",
    };
  }
}

export async function updateDoctorProfile(data: DoctorProfilePayload): Promise<ActionResult> {
  try {
    const session = await requireDoctorSession();
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const specialty = data.specialty.trim();
    const availability = data.availability.trim();
    const status = normalizeDoctorStatus(data.status);

    if (!name || !email || !specialty || !availability) {
      return { success: false, error: "Name, email, specialization, and availability are required." };
    }

    if (!validateEmail(email)) {
      return { success: false, error: "Enter a valid email address." };
    }

    const currentDoctor = await prisma.doctor.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });

    if (!currentDoctor) {
      return { success: false, error: "Doctor account not found." };
    }

    const emailChanged = currentDoctor.email.toLowerCase() !== email;
    if (emailChanged) {
      const cleanOtp = data.otp?.trim() || "";
      if (!cleanOtp || cleanOtp.length !== 6) {
        return {
          success: false,
          error: "A 6-digit verification code is required to update your contact email.",
        };
      }

      const otpStatus = await verifyOtp("doctor", session.userId, cleanOtp);
      if (otpStatus !== "valid") {
        return {
          success: false,
          error: otpStatus === "expired" ? "Verification code has expired. Please request a new one." : "Invalid verification code.",
        };
      }
    }

    const consultFee = parseOptionalNumber(data.consultFee);
    const yearsExp = parseOptionalNumber(data.yearsExp);
    const consultationDuration = parseDuration(data.consultationDuration);
    const consultationDurationUnit = normalizeDurationUnit(data.consultationDurationUnit);

    const existing = await prisma.doctor.findFirst({
      where: {
        email,
        NOT: { id: session.userId },
      },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "That email is already used by another doctor account." };
    }

    const updatedDoctor = await prisma.doctor.update({
      where: { id: session.userId },
      data: {
        email,
        image: normalizeOptional(data.image),
        specialty,
        availability,
        status,
        bio: normalizeOptional(data.bio),
        consultFee,
        yearsExp,
        consultationDuration,
        consultationDurationUnit,
      },
    });

    revalidatePath("/doctor/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.error("updateDoctorProfile failed:", error);
    return { success: false, error: "Could not update doctor profile." };
  }
}

export async function updateDoctorStatus(status: string): Promise<ActionResult> {
  const nextStatus = normalizeDoctorStatus(status);

  try {
    const session = await requireDoctorSession();

    await prisma.doctor.update({
      where: { id: session.userId },
      data: { status: nextStatus },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");

    return { success: true };
  } catch (error: unknown) {
    console.error("updateDoctorStatus failed:", error);
    return { success: false, error: "Could not update doctor status." };
  }
}

export async function updatePatientProfile(data: PatientProfilePayload): Promise<ActionResult> {
  try {
    const session = await requirePatientSession();
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();
    const dob = data.dob.trim();

    if (!firstName || !lastName || !email || !phone || !dob) {
      return { success: false, error: "First name, last name, email, phone, and date of birth are required." };
    }

    if (!validateEmail(email)) {
      return { success: false, error: "Enter a valid email address." };
    }

    const existing = await prisma.patient.findFirst({
      where: {
        email,
        NOT: { id: session.userId },
      },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "That email is already used by another patient account." };
    }

    await prisma.patient.update({
      where: { id: session.userId },
      data: {
        firstName,
        lastName,
        email,
        image: normalizeOptional(data.image),
        countryCode: data.countryCode.trim() || "+1",
        phone,
        dob,
        gender: normalizeOptional(data.gender),
        address: normalizeOptional(data.address),
        city: normalizeOptional(data.city),
        state: normalizeOptional(data.state),
        zipCode: normalizeOptional(data.zipCode),
        country: normalizeOptional(data.country),
        height: normalizeOptional(data.height),
        weight: normalizeOptional(data.weight),
        bloodType: normalizeOptional(data.bloodType),
        allergies: normalizeOptional(data.allergies),
        existingConditions: normalizeOptional(data.existingConditions),
        currentMedications: normalizeOptional(data.currentMedications),
        emergencyContactName: normalizeOptional(data.emergencyContactName),
        emergencyContactPhone: normalizeOptional(data.emergencyContactPhone),
        emergencyContactRelation: normalizeOptional(data.emergencyContactRelation),
      },
    });

    revalidatePath("/patient/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.error("updatePatientProfile failed:", error);
    return { success: false, error: "Could not update patient profile." };
  }
}

export async function updateDoctorPassword(data: PasswordPayload): Promise<ActionResult> {
  const validationError = validatePasswordPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  if (!data.otp?.trim()) {
    return { success: false, error: "Please enter the verification code sent to your email." };
  }

  try {
    const session = await requireDoctorSession();

    // Verify OTP before touching the password
    const otpResult = await verifyOtp("doctor", session.userId, data.otp.trim());
    if (otpResult === "expired") {
      return { success: false, error: "The verification code has expired. Please request a new one." };
    }
    if (otpResult === "invalid") {
      return { success: false, error: "Incorrect verification code. Please try again." };
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: session.userId },
      select: { password: true },
    });

    if (!doctor || !(await bcrypt.compare(data.currentPassword, doctor.password))) {
      return { success: false, error: "Current password is incorrect." };
    }

    await prisma.doctor.update({
      where: { id: session.userId },
      data: { password: await bcrypt.hash(data.newPassword, 12) },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("updateDoctorPassword failed:", error);
    return { success: false, error: "Could not update password." };
  }
}

export async function updatePatientPassword(data: PasswordPayload): Promise<ActionResult> {
  const validationError = validatePasswordPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  if (!data.otp?.trim()) {
    return { success: false, error: "Please enter the verification code sent to your email." };
  }

  try {
    const session = await requirePatientSession();

    const otpResult = await verifyOtp("patient", session.userId, data.otp.trim());
    if (otpResult === "expired") {
      return { success: false, error: "The verification code has expired. Please request a new one." };
    }
    if (otpResult === "invalid") {
      return { success: false, error: "Incorrect verification code. Please try again." };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: session.userId },
      select: { password: true },
    });

    if (!patient || !(await bcrypt.compare(data.currentPassword, patient.password))) {
      return { success: false, error: "Current password is incorrect." };
    }

    await prisma.patient.update({
      where: { id: session.userId },
      data: { password: await bcrypt.hash(data.newPassword, 12) },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("updatePatientPassword failed:", error);
    return { success: false, error: "Could not update password." };
  }
}
