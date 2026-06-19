"use server";

import { revalidatePath } from "next/cache";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { requireDoctorSession } from "@/lib/auth/doctor-session";
import { mockDb } from "@/lib/mockDb";
import {
  DEFAULT_DURATION_MINUTES,
  getFullyBookedMessage,
  getScheduleConflict,
} from "@/lib/scheduling";

async function validatePrismaDoctorSchedule({
  doctorId,
  scheduledAt,
  durationMinutes = DEFAULT_DURATION_MINUTES,
  excludeAppointmentId,
}: {
  doctorId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  excludeAppointmentId?: string;
}) {
  const confirmedAppointments = await prisma.consultation.findMany({
    where: { doctorId, status: "CONFIRMED" },
    select: { id: true, scheduledAt: true, duration: true, status: true },
  });

  const conflict = getScheduleConflict(confirmedAppointments, scheduledAt, durationMinutes, excludeAppointmentId);
  return conflict ? getFullyBookedMessage() : "";
}

function validateMockDoctorSchedule({
  doctorId,
  scheduledAt,
  durationMinutes = DEFAULT_DURATION_MINUTES,
  excludeAppointmentId,
}: {
  doctorId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  excludeAppointmentId?: string;
}) {
  const conflict = getScheduleConflict(
    mockDb.getBookingsForDoctor(doctorId),
    scheduledAt,
    durationMinutes,
    excludeAppointmentId
  );

  return conflict ? getFullyBookedMessage() : "";
}

export async function acceptAppointment(consultationId: string) {
  try {
    const session = await requireDoctorSession();

    if (!isPrismaConfigured()) {
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt: new Date(existing.scheduledAt),
        durationMinutes: existing.duration || DEFAULT_DURATION_MINUTES,
        excludeAppointmentId: consultationId,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const updated = mockDb.updateConsultation(consultationId, { status: "CONFIRMED" });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    }

    // Verify ownership in Prisma
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const scheduleError = await validatePrismaDoctorSchedule({
      doctorId: session.userId,
      scheduledAt: consultation.scheduledAt,
      durationMinutes: consultation.duration || DEFAULT_DURATION_MINUTES,
      excludeAppointmentId: consultationId,
    });

    if (scheduleError) {
      return { success: false, error: scheduleError };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: "CONFIRMED" },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("Prisma acceptAppointment failed:", error);
    return { success: false, error: "Failed to accept appointment in database." };
  }
}

export async function cancelAppointment(consultationId: string) {
  try {
    const session = await requireDoctorSession();

    if (!isPrismaConfigured()) {
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const updated = mockDb.updateConsultation(consultationId, { status: "CANCELLED" });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    }

    // Verify ownership in Prisma
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("Prisma cancelAppointment failed:", error);
    return { success: false, error: "Failed to cancel appointment in database." };
  }
}

type CompleteConsultationPayload = {
  consultationId: string;
  notes: string;
  prescription: string;
  reason?: string; // Diagnosis
};

type UpdateConsultationVitalsPayload = {
  consultationId: string;
  bloodPressure: string;
  heartRate: string;
  bodyTemperature: string;
};

type RescheduleAppointmentPayload = {
  consultationId: string;
  scheduledAt: string;
};

type ScheduleFollowUpPayload = {
  patientId: string;
  scheduledAt: string;
  reason: string;
};

type ReferAppointmentPayload = {
  consultationId: string;
  targetDoctorId: string;
  note?: string;
};

export async function completeConsultation(data: CompleteConsultationPayload) {
  try {
    const session = await requireDoctorSession();
    const { consultationId, notes, prescription, reason } = data;

    if (!isPrismaConfigured()) {
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);
      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const updated = mockDb.updateConsultation(consultationId, {
        status: "COMPLETED",
        notes,
        prescription,
        reason: reason || existing.reason,
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    }

    // Verify ownership in Prisma
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: "COMPLETED",
        notes,
        prescription,
        reason: reason || consultation.reason,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("Prisma completeConsultation failed:", error);
    return { success: false, error: "Failed to complete consultation in database." };
  }
}

export async function updateConsultationVitals(data: UpdateConsultationVitalsPayload) {
  try {
    const session = await requireDoctorSession();
    const bloodPressure = data.bloodPressure.trim();
    const heartRate = data.heartRate.trim();
    const bodyTemperature = data.bodyTemperature.trim();

    if (!data.consultationId) {
      return { success: false, error: "Consultation is required." };
    }

    if (!bloodPressure && !heartRate && !bodyTemperature) {
      return { success: false, error: "Add at least one vital sign before saving." };
    }

    if (!isPrismaConfigured()) {
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === data.consultationId);
      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const updated = mockDb.updateConsultation(data.consultationId, {
        bloodPressure: bloodPressure || null,
        heartRate: heartRate || null,
        bodyTemperature: bodyTemperature || null,
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: data.consultationId },
      select: { id: true, doctorId: true },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const updated = await prisma.consultation.update({
      where: { id: data.consultationId },
      data: {
        bloodPressure: bloodPressure || null,
        heartRate: heartRate || null,
        bodyTemperature: bodyTemperature || null,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("updateConsultationVitals failed:", error);
    return { success: false, error: "Failed to update consultation vitals." };
  }
}

export async function rescheduleAppointment(data: RescheduleAppointmentPayload) {
  try {
    const session = await requireDoctorSession();
    const scheduledAt = new Date(data.scheduledAt);

    if (!data.consultationId || Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
      return { success: false, error: "Choose a valid future consultation time." };
    }

    if (!isPrismaConfigured()) {
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === data.consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or invalid appointment time." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt,
        durationMinutes: existing.duration || DEFAULT_DURATION_MINUTES,
        excludeAppointmentId: data.consultationId,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const updated = mockDb.updateConsultation(data.consultationId, {
        scheduledAt: scheduledAt.toISOString(),
        status: existing.status === "PENDING" ? "CONFIRMED" : existing.status,
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: data.consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const scheduleError = await validatePrismaDoctorSchedule({
      doctorId: session.userId,
      scheduledAt,
      durationMinutes: consultation.duration || DEFAULT_DURATION_MINUTES,
      excludeAppointmentId: data.consultationId,
    });

    if (scheduleError) {
      return { success: false, error: scheduleError };
    }

    const updated = await prisma.consultation.update({
      where: { id: data.consultationId },
      data: {
        scheduledAt,
        status: consultation.status === "PENDING" ? "CONFIRMED" : consultation.status,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("Prisma rescheduleAppointment failed:", error);
    return { success: false, error: "Failed to reschedule appointment in database." };
  }
}

export async function scheduleFollowUpAppointment(data: ScheduleFollowUpPayload) {
  try {
    const session = await requireDoctorSession();
    const scheduledAt = new Date(data.scheduledAt);
    const reason = data.reason.trim();

    if (!data.patientId || !reason || Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
      return { success: false, error: "Choose a patient, future time, and follow-up reason." };
    }

    if (!isPrismaConfigured()) {
      const patientHistory = mockDb
        .getBookingsForDoctor(session.userId)
        .some((booking) => booking.patient?.id === data.patientId);

      if (!patientHistory) {
        return { success: false, error: "Follow-up scheduling is only available for existing patients." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const consultation = mockDb.createConsultation({
        patientId: data.patientId,
        doctorId: session.userId,
        scheduledAt,
        reason,
        status: "PENDING",
        duration: DEFAULT_DURATION_MINUTES,
      });
      mockDb.updateConsultation(consultation.id, {
        notes: "Follow-up requested by doctor. Awaiting patient confirmation.",
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation };
    }

    const patientHistory = await prisma.consultation.findFirst({
      where: {
        patientId: data.patientId,
        doctorId: session.userId,
      },
      select: { id: true },
    });

    if (!patientHistory) {
      return { success: false, error: "Follow-up scheduling is only available for existing patients." };
    }

    const scheduleError = await validatePrismaDoctorSchedule({
      doctorId: session.userId,
      scheduledAt,
    });

    if (scheduleError) {
      return { success: false, error: scheduleError };
    }

    const consultation = await prisma.consultation.create({
      data: {
        patientId: data.patientId,
        doctorId: session.userId,
        scheduledAt,
        reason,
        status: "PENDING",
        notes: "Follow-up requested by doctor. Awaiting patient confirmation.",
        duration: DEFAULT_DURATION_MINUTES,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation };
  } catch (error: unknown) {
    console.error("Prisma scheduleFollowUpAppointment failed:", error);
    return { success: false, error: "Failed to schedule follow-up appointment in database." };
  }
}

export async function referAppointment(data: ReferAppointmentPayload) {
  try {
    const session = await requireDoctorSession();

    if (!data.consultationId || !data.targetDoctorId || data.targetDoctorId === session.userId) {
      return { success: false, error: "Choose another doctor for referral." };
    }

    if (!isPrismaConfigured()) {
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === data.consultationId);
      const targetDoctor = mockDb.findDoctorById(data.targetDoctorId);

      if (!existing?.patient || !targetDoctor || data.targetDoctorId === session.userId) {
        return { success: false, error: "Consultation or recommended doctor was not found." };
      }

      mockDb.updateConsultation(data.consultationId, {
        status: "CANCELLED",
        notes: [existing.notes, `Referred to ${targetDoctor.name} (${targetDoctor.specialty}). ${data.note || ""}`]
          .filter(Boolean)
          .join("\n"),
      });

      const referred = mockDb.createConsultation({
        patientId: existing.patient.id,
        doctorId: data.targetDoctorId,
        scheduledAt: new Date(existing.scheduledAt),
        reason: existing.reason || "Referral consultation",
        status: "PENDING",
        duration: existing.duration || 30,
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: referred, targetDoctor };
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: data.consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const targetDoctor = await prisma.doctor.findUnique({
      where: { id: data.targetDoctorId },
      select: { id: true, name: true, specialty: true, isActive: true },
    });

    if (!targetDoctor?.isActive) {
      return { success: false, error: "Recommended doctor is not available." };
    }

    await prisma.consultation.update({
      where: { id: data.consultationId },
      data: {
        status: "CANCELLED",
        notes: [consultation.notes, `Referred to ${targetDoctor.name} (${targetDoctor.specialty}). ${data.note || ""}`]
          .filter(Boolean)
          .join("\n"),
      },
    });

    const referred = await prisma.consultation.create({
      data: {
        patientId: consultation.patientId,
        doctorId: data.targetDoctorId,
        scheduledAt: consultation.scheduledAt,
        reason: consultation.reason,
        duration: consultation.duration,
        status: "PENDING",
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: referred, targetDoctor };
  } catch (error: unknown) {
    console.error("Prisma referAppointment failed:", error);
    return { success: false, error: "Failed to refer appointment in database." };
  }
}
