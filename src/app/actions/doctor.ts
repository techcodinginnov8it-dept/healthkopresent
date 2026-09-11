"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDoctorSession } from "@/lib/auth/doctor-session";
import {
  DEFAULT_DURATION_MINUTES,
  getFullyBookedMessage,
  getScheduleConflict,
} from "@/lib/scheduling";
import { formatNotesWithTranscript, parseNotesAndTranscript } from "@/lib/consultation-transcript-pdf";

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

export async function acceptAppointment(consultationId: string) {
  try {
    const session = await requireDoctorSession();

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
    console.error("acceptAppointment failed:", error);
    return { success: false, error: "Failed to accept appointment in database." };
  }
}

export async function cancelAppointment(consultationId: string, cancellationNotes?: string) {
  try {
    const session = await requireDoctorSession();

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: "CANCELLED",
        ...(cancellationNotes ? { notes: cancellationNotes } : {}),
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("cancelAppointment failed:", error);
    return { success: false, error: "Failed to cancel appointment in database." };
  }
}

type CompleteConsultationPayload = {
  consultationId: string;
  notes?: string;
  prescription?: string;
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
        notes: notes !== undefined ? notes : consultation.notes,
        prescription: prescription !== undefined ? prescription : consultation.prescription,
        reason: reason || consultation.reason,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("completeConsultation failed:", error);
    return { success: false, error: "Failed to complete consultation in database." };
  }
}

export async function saveConsultationTranscript(data: {
  consultationId: string;
  turns: Array<{ speaker: string; role: "doctor" | "patient" | "system"; text: string; timestamp?: string }>;
}) {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: data.consultationId },
    });

    if (!consultation) {
      return { success: false, error: "Consultation not found." };
    }

    const { clinicalNotes } = parseNotesAndTranscript(consultation.notes);
    const updatedNotes = formatNotesWithTranscript(clinicalNotes, data.turns);

    const updated = await prisma.consultation.update({
      where: { id: data.consultationId },
      data: {
        notes: updatedNotes,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.error("saveConsultationTranscript failed:", error);
    return { success: false, error: "Failed to save transcript." };
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
    console.error("rescheduleAppointment failed:", error);
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
    console.error("scheduleFollowUpAppointment failed:", error);
    return { success: false, error: "Failed to schedule follow-up appointment in database." };
  }
}

export async function referAppointment(data: ReferAppointmentPayload) {
  try {
    const session = await requireDoctorSession();

    if (!data.consultationId || !data.targetDoctorId || data.targetDoctorId === session.userId) {
      return { success: false, error: "Choose another doctor for referral." };
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
    console.error("referAppointment failed:", error);
    return { success: false, error: "Failed to refer appointment in database." };
  }
}

// ---------------------------------------------------------------------------
// Medical Certificate Actions
// ---------------------------------------------------------------------------

export type IssueMedicalCertificatePayload = {
  patientId: string;
  consultationId?: string;
  purpose: "sick_leave" | "fitness_to_work" | "school" | "other";
  diagnosis?: string;
  remarks?: string;
  restDaysFrom?: string; // ISO date string
  restDaysTo?: string;   // ISO date string
};

export async function issueMedicalCertificate(data: IssueMedicalCertificatePayload) {
  try {
    const session = await requireDoctorSession();

    if (!data.patientId) {
      return { success: false, error: "Patient is required." };
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, specialty: true, licenseNumber: true, npi: true },
    });

    if (!doctor) {
      return { success: false, error: "Doctor profile not found." };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!patient) {
      return { success: false, error: "Patient not found." };
    }

    // Verify relationship if consultation is provided
    if (data.consultationId) {
      const consultation = await prisma.consultation.findUnique({
        where: { id: data.consultationId },
      });
      if (!consultation || consultation.doctorId !== session.userId || consultation.patientId !== data.patientId) {
        return { success: false, error: "Consultation not found or unauthorized." };
      }
    }

    // Generate a unique cert number: MC-XXXXXXXX
    const certNumber = `MC-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    const cert = await prisma.medicalCertificate.create({
      data: {
        doctorId: session.userId,
        patientId: data.patientId,
        consultationId: data.consultationId || null,
        purpose: data.purpose,
        diagnosis: data.diagnosis || null,
        remarks: data.remarks || null,
        restDaysFrom: data.restDaysFrom ? new Date(data.restDaysFrom) : null,
        restDaysTo: data.restDaysTo ? new Date(data.restDaysTo) : null,
        certNumber,
      },
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, dob: true, gender: true, address: true, city: true, state: true },
        },
        doctor: {
          select: { id: true, name: true, specialty: true, licenseNumber: true, npi: true },
        },
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, certificate: cert };
  } catch (error: unknown) {
    console.error("issueMedicalCertificate failed:", error);
    return { success: false, error: "Failed to issue medical certificate." };
  }
}

export async function getDoctorMedicalCertificates() {
  try {
    const session = await requireDoctorSession();

    const certificates = await prisma.medicalCertificate.findMany({
      where: { doctorId: session.userId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dob: true,
            gender: true,
            address: true,
            city: true,
            state: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            licenseNumber: true,
            npi: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    return { success: true, certificates };
  } catch (error: unknown) {
    console.error("getDoctorMedicalCertificates failed:", error);
    return { success: false, error: "Failed to fetch medical certificates." };
  }
}

