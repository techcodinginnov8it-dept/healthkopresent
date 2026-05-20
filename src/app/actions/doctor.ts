"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDoctorSession } from "@/lib/auth/doctor-session";
import { mockDb } from "@/lib/mockDb";

export async function acceptAppointment(consultationId: string) {
  try {
    const session = await requireDoctorSession();

    // Verify ownership in Prisma
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: "CONFIRMED" },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: any) {
    console.warn("Prisma acceptAppointment failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const updated = mockDb.updateConsultation(consultationId, { status: "CONFIRMED" });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    } catch (mockErr) {
      console.error("Failed to accept appointment in mock fallback:", mockErr);
      return { success: false, error: "System failed to approve consultation request." };
    }
  }
}

export async function cancelAppointment(consultationId: string) {
  try {
    const session = await requireDoctorSession();

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
  } catch (error: any) {
    console.warn("Prisma cancelAppointment failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const updated = mockDb.updateConsultation(consultationId, { status: "CANCELLED" });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    } catch (mockErr) {
      console.error("Failed to cancel appointment in mock fallback:", mockErr);
      return { success: false, error: "System failed to cancel consultation request." };
    }
  }
}

type CompleteConsultationPayload = {
  consultationId: string;
  notes: string;
  prescription: string;
  reason?: string; // Diagnosis
};

export async function completeConsultation(data: CompleteConsultationPayload) {
  try {
    const session = await requireDoctorSession();
    const { consultationId, notes, prescription, reason } = data;

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
  } catch (error: any) {
    console.warn("Prisma completeConsultation failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const { consultationId, notes, prescription, reason } = data;

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
    } catch (mockErr) {
      console.error("Failed to complete consultation in mock fallback:", mockErr);
      return { success: false, error: "Clinical documentation upload failed." };
    }
  }
}
