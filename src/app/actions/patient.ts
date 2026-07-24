"use server";

import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/errors";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { mockDb } from "@/lib/mockDb";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_DURATION_MINUTES,
  getFullyBookedMessage,
  getOutsideAvailabilityMessage,
  getScheduleConflict,
  isWithinDoctorAvailability,
} from "@/lib/scheduling";

export async function getDoctorsList() {
  if (!isPrismaConfigured()) {
    return getMockDoctorsList();
  }

  try {
    const doctors = await prisma.doctor.findMany({
      where: { isActive: true, isVerified: true },
      select: {
        id: true,
        name: true,
        npi: true,
        email: true,
        specialty: true,
        bio: true,
        image: true,
        availability: true,
        status: true,
        consultFee: true,
        rating: true,
        reviewCount: true,
        isVerified: true,
        licenseNumber: true,
        licenseState: true,
        yearsExp: true,
      },
    });
    return { success: true, doctors };
  } catch (error: unknown) {
    console.error("Prisma getDoctorsList failed:", error);
    return { success: false, error: getErrorMessage(error, "Failed to retrieve doctors directory.") };
  }
}

function getMockDoctorsList() {
  try {
    const doctors = mockDb.getDoctorsList();
    return { success: true, doctors };
  } catch (mockErr) {
    console.error("Failed to retrieve doctors list:", mockErr);
    return { success: false, error: "Failed to retrieve physician directory." };
  }
}

type BookAppointmentPayload = {
  doctorId: string;
  scheduledAt: string; // ISO string
  reason: string;
};

export async function bookAppointment(data: BookAppointmentPayload) {
  if (!isPrismaConfigured()) {
    return bookMockAppointment(data);
  }

  try {
    const session = await requirePatientSession();
    const { doctorId, scheduledAt, reason } = data;

    if (!doctorId || !scheduledAt || !reason) {
      return { success: false, error: "Doctor, date/time, and reason are required." };
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      return { success: false, error: "Please provide a valid future appointment date and time." };
    }

    // Ensure the patient exists in Postgres and has a linked User row.
    let patientRecord = null;
    try {
      patientRecord = await prisma.patient.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          email: true,
          password: true,
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
          countryCode: true,
          phone: true,
          dob: true,
          gender: true,
          hipaaConsent: true,
          emailVerified: true,
          isActive: true,
          userId: true,
          user: {
            select: { id: true, email: true, password: true, role: true },
          },
        },
      });
    } catch (err) {
      console.warn("[bookAppointment] Failed to load patient record in Postgres:", err);
    }

    if (!patientRecord) {
      console.log(`[bookAppointment] Patient "${session.userId}" not found in Postgres. Attempting to sync from mockDb...`);
      const mockPatient = mockDb.findPatientById(session.userId) || mockDb.findPatientByEmail(session.email);
      if (!mockPatient) {
        console.warn(`[bookAppointment] Patient not found in mockDb either!`);
        return { success: false, error: "Patient session is invalid or record not found." };
      }

      try {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const user = await tx.user.upsert({
            where: { email: mockPatient.email.toLowerCase() },
            create: {
              email: mockPatient.email.toLowerCase(),
              password: mockPatient.password,
              role: "PATIENT",
              emailVerified: mockPatient.emailVerified,
              isActive: mockPatient.isActive,
            },
            update: {
              password: mockPatient.password,
              role: "PATIENT",
              emailVerified: mockPatient.emailVerified,
              isActive: mockPatient.isActive,
            },
          });

          await tx.patient.create({
            data: {
              id: session.userId,
              userId: user.id,
              firstName: mockPatient.firstName,
              middleName: mockPatient.middleName,
              lastName: mockPatient.lastName,
              suffix: mockPatient.suffix,
              email: mockPatient.email.toLowerCase(),
              countryCode: mockPatient.countryCode,
              phone: mockPatient.phone,
              dob: mockPatient.dob,
              gender: mockPatient.gender,
              password: mockPatient.password,
              hipaaConsent: mockPatient.hipaaConsent,
              emailVerified: mockPatient.emailVerified,
              isActive: mockPatient.isActive,
            },
          });
        });
        console.log(`[bookAppointment] Successfully synced mock patient "${mockPatient.email}" to Postgres with ID "${session.userId}"`);
      } catch (syncErr) {
        console.error(`[bookAppointment] Failed to sync mock patient to Postgres:`, syncErr);
        return { success: false, error: "Could not initialize patient record in the database." };
      }
    } else if (!patientRecord.userId || !patientRecord.user || patientRecord.user.email !== patientRecord.email || patientRecord.user.password !== patientRecord.password || patientRecord.user.role !== "PATIENT") {
      try {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const user = await tx.user.upsert({
            where: { email: patientRecord.email.toLowerCase() },
            create: {
              email: patientRecord.email.toLowerCase(),
              password: patientRecord.password,
              role: "PATIENT",
              emailVerified: patientRecord.emailVerified,
              isActive: patientRecord.isActive,
            },
            update: {
              password: patientRecord.password,
              role: "PATIENT",
              emailVerified: patientRecord.emailVerified,
              isActive: patientRecord.isActive,
            },
          });

          await tx.patient.update({
            where: { id: patientRecord.id },
            data: { userId: user.id },
          });
        });
      } catch (syncErr) {
        console.error("[bookAppointment] Failed to backfill patient user link:", syncErr);
        return { success: false, error: "Could not initialize patient record in the database." };
      }
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { isActive: true, isVerified: true, availability: true },
    });

    if (!doctor) {
      console.warn(`[bookAppointment] Doctor not found in DB. doctorId received: "${doctorId}"`);
      return { success: false, error: "Selected doctor is not available for bookings." };
    }
    if (!doctor.isActive || !doctor.isVerified) {
      console.warn(`[bookAppointment] Doctor found but not active/verified. doctorId: "${doctorId}", isActive: ${doctor.isActive}, isVerified: ${doctor.isVerified}`);
      return { success: false, error: "Selected doctor is not available for bookings." };
    }

    if (!isWithinDoctorAvailability(scheduledDate, DEFAULT_DURATION_MINUTES, doctor)) {
      return { success: false, error: getOutsideAvailabilityMessage(doctor.availability) };
    }

    // Check patient schedule overlap (checking PENDING and CONFIRMED)
    const patientAppointments = await prisma.consultation.findMany({
      where: {
        patientId: session.userId,
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      select: { id: true, scheduledAt: true, duration: true, status: true },
    });

    const patientConflict = getScheduleConflict(
      patientAppointments,
      scheduledDate,
      DEFAULT_DURATION_MINUTES,
      undefined,
      ["CONFIRMED", "PENDING"]
    );
    if (patientConflict) {
      return { success: false, error: "You already have a pending or confirmed appointment in this time window." };
    }

    // Check doctor schedule conflict (checking PENDING and CONFIRMED)
    const existingAppointments = await prisma.consultation.findMany({
      where: {
        doctorId,
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      select: { id: true, scheduledAt: true, duration: true, status: true },
    });

    const conflict = getScheduleConflict(
      existingAppointments,
      scheduledDate,
      DEFAULT_DURATION_MINUTES,
      undefined,
      ["CONFIRMED", "PENDING"]
    );
    if (conflict) {
      return { success: false, error: getFullyBookedMessage() };
    }

    const consultation = await prisma.consultation.create({
      data: {
        patientId: session.userId,
        doctorId,
        scheduledAt: scheduledDate,
        reason,
        status: "PENDING",
        duration: DEFAULT_DURATION_MINUTES,
      },
    });

    revalidatePath("/patient/dashboard");
    return { success: true, consultation };
  } catch (error: unknown) {
    console.error("Prisma bookAppointment failed:", error);
    return { success: false, error: getErrorMessage(error, "Failed to book appointment in database.") };
  }
}

export async function confirmFollowUpAppointment(consultationId: string) {
  if (!isPrismaConfigured()) {
    return confirmMockFollowUpAppointment(consultationId);
  }

  try {
    const session = await requirePatientSession();
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, patientId: true, status: true, notes: true },
    });

    if (!consultation || consultation.patientId !== session.userId) {
      return { success: false, error: "Follow-up appointment was not found." };
    }

    if (consultation.status !== "PENDING" || !consultation.notes?.includes("Follow-up requested by doctor")) {
      return { success: false, error: "Only pending doctor follow-ups can be confirmed here." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: "CONFIRMED",
        notes: [consultation.notes, "Patient confirmed this follow-up appointment."].filter(Boolean).join("\n"),
      },
    });

    revalidatePath("/patient/dashboard");
    revalidatePath("/doctor/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("Prisma confirmFollowUpAppointment failed:", error);
    return { success: false, error: getErrorMessage(error, "Failed to confirm follow-up appointment.") };
  }
}

type FollowUpReschedulePayload = {
  consultationId: string;
  requestedScheduledAt: string;
};

export async function requestFollowUpReschedule(data: FollowUpReschedulePayload) {
  if (!isPrismaConfigured()) {
    return requestMockFollowUpReschedule(data);
  }

  try {
    const session = await requirePatientSession();
    const { consultationId, requestedScheduledAt } = data;
    const requestedDate = new Date(requestedScheduledAt);

    if (Number.isNaN(requestedDate.getTime()) || requestedDate <= new Date()) {
      return { success: false, error: "Choose a valid future date and time for the reschedule request." };
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: {
        id: true,
        patientId: true,
        status: true,
        notes: true,
        doctorId: true,
        doctor: {
          select: { availability: true }
        }
      },
    });

    if (!consultation || consultation.patientId !== session.userId) {
      return { success: false, error: "Follow-up appointment was not found." };
    }

    if (!isWithinDoctorAvailability(requestedDate, DEFAULT_DURATION_MINUTES, consultation.doctor)) {
      return { success: false, error: getOutsideAvailabilityMessage(consultation.doctor.availability) };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: "PENDING",
        scheduledAt: requestedDate,
        notes: [
          consultation.notes,
          `Patient requested rescheduling to ${requestedDate.toISOString()} on ${new Date().toISOString()}. Doctor review required.`,
        ].filter(Boolean).join("\n"),
      },
    });

    revalidatePath("/patient/dashboard");
    revalidatePath("/doctor/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("Prisma requestFollowUpReschedule failed:", error);
    return { success: false, error: getErrorMessage(error, "Failed to request follow-up rescheduling.") };
  }
}

async function bookMockAppointment(data: BookAppointmentPayload) {
  try {
    const session = await requirePatientSession();
    const { doctorId, scheduledAt, reason } = data;

    if (!doctorId || !scheduledAt || !reason) {
      return { success: false, error: "Doctor, date/time, and reason are required." };
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: "Please provide a valid appointment date and time." };
    }

    const doctor = mockDb.findDoctorById(doctorId);
    if (!doctor || !doctor.isActive || !doctor.isVerified) {
      return { success: false, error: "Selected doctor is not available." };
    }

    if (!isWithinDoctorAvailability(scheduledDate, DEFAULT_DURATION_MINUTES, doctor)) {
      return { success: false, error: getOutsideAvailabilityMessage(doctor.availability) };
    }

    // Check patient schedule overlap (checking PENDING and CONFIRMED)
    const patientBookings = mockDb.getBookingsForPatient(session.userId);
    const patientConflict = getScheduleConflict(
      patientBookings,
      scheduledDate,
      DEFAULT_DURATION_MINUTES,
      undefined,
      ["CONFIRMED", "PENDING"]
    );
    if (patientConflict) {
      return { success: false, error: "You already have a pending or confirmed appointment in this time window." };
    }

    // Check doctor schedule conflict (checking PENDING and CONFIRMED)
    const doctorBookings = mockDb.getBookingsForDoctor(doctorId);
    const conflict = getScheduleConflict(
      doctorBookings,
      scheduledDate,
      DEFAULT_DURATION_MINUTES,
      undefined,
      ["CONFIRMED", "PENDING"]
    );
    if (conflict) {
      return { success: false, error: getFullyBookedMessage() };
    }

    const consultation = mockDb.createConsultation({
      patientId: session.userId,
      doctorId,
      scheduledAt: scheduledDate,
      reason,
      status: "PENDING",
      duration: DEFAULT_DURATION_MINUTES,
    });

    revalidatePath("/patient/dashboard");
    return { success: true, consultation };
  } catch (mockErr) {
    console.error("Appointment booking mock fallback failed:", mockErr);
    return { success: false, error: "Clinical reservation system failed. Please try again." };
  }
}

async function confirmMockFollowUpAppointment(consultationId: string) {
  try {
    const session = await requirePatientSession();
    const existing = mockDb.getBookingsForPatient(session.userId).find((booking) => booking.id === consultationId);

    if (!existing) {
      return { success: false, error: "Follow-up appointment was not found." };
    }

    if (existing.status !== "PENDING" || !existing.notes?.includes("Follow-up requested by doctor")) {
      return { success: false, error: "Only pending doctor follow-ups can be confirmed here." };
    }

    const updated = mockDb.updateConsultation(consultationId, {
      status: "CONFIRMED",
      notes: [existing.notes, "Patient confirmed this follow-up appointment."].filter(Boolean).join("\n"),
    });

    revalidatePath("/patient/dashboard");
    revalidatePath("/doctor/dashboard");
    return { success: true, consultation: updated };
  } catch (mockErr) {
    console.error("Follow-up confirmation mock fallback failed:", mockErr);
    return { success: false, error: "Could not confirm follow-up appointment." };
  }
}

async function requestMockFollowUpReschedule(data: FollowUpReschedulePayload) {
  try {
    const session = await requirePatientSession();
    const { consultationId, requestedScheduledAt } = data;
    const requestedDate = new Date(requestedScheduledAt);

    if (Number.isNaN(requestedDate.getTime()) || requestedDate <= new Date()) {
      return { success: false, error: "Choose a valid future date and time for the reschedule request." };
    }

    const existing = mockDb.getBookingsForPatient(session.userId).find((booking) => booking.id === consultationId);

    if (!existing) {
      return { success: false, error: "Follow-up appointment was not found." };
    }

    const doctor = mockDb.findDoctorById(existing.doctorId);
    if (!doctor) {
      return { success: false, error: "Doctor not found." };
    }

    if (!isWithinDoctorAvailability(requestedDate, DEFAULT_DURATION_MINUTES, doctor)) {
      return { success: false, error: getOutsideAvailabilityMessage(doctor.availability) };
    }

    const updated = mockDb.updateConsultation(consultationId, {
      status: "PENDING",
      scheduledAt: requestedDate.toISOString(),
      notes: [
        existing.notes,
        `Patient requested rescheduling to ${requestedDate.toISOString()} on ${new Date().toISOString()}. Doctor review required.`,
      ].filter(Boolean).join("\n"),
    });

    revalidatePath("/patient/dashboard");
    revalidatePath("/doctor/dashboard");
    return { success: true, consultation: updated };
  } catch (mockErr) {
    console.error("Follow-up reschedule mock fallback failed:", mockErr);
    return { success: false, error: "Could not request follow-up rescheduling." };
  }
}
