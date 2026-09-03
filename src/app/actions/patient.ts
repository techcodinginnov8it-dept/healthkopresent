"use server";

import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";
import {
  DEFAULT_DURATION_MINUTES,
  getFullyBookedMessage,
  getOutsideAvailabilityMessage,
  getScheduleConflict,
  isWithinDoctorAvailability,
} from "@/lib/scheduling";

export async function getDoctorsList() {
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
    console.error("getDoctorsList failed:", error);
    return { success: false, error: getErrorMessage(error, "Failed to retrieve doctors directory.") };
  }
}

type BookAppointmentPayload = {
  doctorId: string;
  scheduledAt: string; // ISO string
  reason: string;
};

export async function bookAppointment(data: BookAppointmentPayload) {
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

    const patientRecord = await prisma.patient.findUnique({
      where: { id: session.userId },
      select: { id: true },
    });

    if (!patientRecord) {
      return { success: false, error: "Patient record not found. Please sign in again." };
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { isActive: true, isVerified: true, availability: true },
    });

    if (!doctor || !doctor.isActive || !doctor.isVerified) {
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
    console.error("bookAppointment failed:", error);
    return { success: false, error: getErrorMessage(error, "Failed to book appointment in database.") };
  }
}

export async function confirmFollowUpAppointment(consultationId: string) {
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
    console.error("confirmFollowUpAppointment failed:", error);
    return { success: false, error: getErrorMessage(error, "Failed to confirm follow-up appointment.") };
  }
}

type FollowUpReschedulePayload = {
  consultationId: string;
  requestedScheduledAt: string;
};

export async function requestFollowUpReschedule(data: FollowUpReschedulePayload) {
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
    console.error("requestFollowUpReschedule failed:", error);
    return { success: false, error: getErrorMessage(error, "Failed to request follow-up rescheduling.") };
  }
}
