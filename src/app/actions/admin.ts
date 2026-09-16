"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth/admin-session";
import type {
  AdminDoctorEntity,
  AdminPatientEntity,
  AdminConsultationEntity,
  AdminSystemStats,
} from "@/lib/dashboard/types";

export type AdminDashboardPayload = {
  success: boolean;
  error?: string;
  stats?: AdminSystemStats;
  audits?: any[];
  doctors?: AdminDoctorEntity[];
  patients?: AdminPatientEntity[];
  consultations?: AdminConsultationEntity[];
};

export async function getAdminDashboardData(): Promise<AdminDashboardPayload> {
  try {
    await requireAdminSession();

    const [
      patients,
      doctors,
      audits,
      consultations,
      activeVideoCount,
    ] = await Promise.all([
      prisma.patient.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { bookings: true },
          },
        },
      }),
      prisma.doctor.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { bookings: true },
          },
          audits: {
            take: 1,
            orderBy: { submittedAt: "desc" },
            select: {
              licenseNumber: true,
              licenseState: true,
            },
          },
        },
      }),
      prisma.doctorAudit.findMany({
        orderBy: { submittedAt: "desc" },
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              email: true,
              specialty: true,
            },
          },
        },
      }),
      prisma.consultation.findMany({
        take: 50,
        orderBy: { scheduledAt: "desc" },
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              specialty: true,
              consultFee: true,
            },
          },
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      (prisma as any).videoSession
        ? (prisma as any).videoSession.count({
            where: { status: { in: ["ACTIVE", "IN_PROGRESS", "RINGING"] } },
          }).catch(() => 0)
        : Promise.resolve(0),
    ]);

    // Map Doctors
    const mappedDoctors: AdminDoctorEntity[] = doctors.map((d) => ({
      id: d.id,
      name: d.name,
      npi: d.npi,
      email: d.email,
      specialty: d.specialty,
      licenseNumber: d.licenseNumber || d.audits[0]?.licenseNumber || null,
      licenseState: d.licenseState || d.audits[0]?.licenseState || null,
      consultFee: d.consultFee ?? 500,
      rating: d.rating ?? 5.0,
      reviewCount: d.reviewCount ?? 0,
      isVerified: Boolean(d.isVerified),
      isActive: Boolean(d.isActive),
      totalConsultations: d._count.bookings,
      joinedAt: d.createdAt.toISOString(),
      phone: null,
    }));

    // Map Patients
    const mappedPatients: AdminPatientEntity[] = patients.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.email,
      phone: p.phone,
      dob: p.dob,
      gender: p.gender ?? null,
      city: p.city ?? null,
      bloodType: p.bloodType ?? null,
      allergies: p.allergies ?? null,
      isActive: Boolean(p.isActive),
      totalConsultations: p._count.bookings,
      joinedAt: p.createdAt.toISOString(),
      emergencyContact: p.emergencyContactName ? `${p.emergencyContactName} (${p.emergencyContactPhone || "No Phone"})` : null,
    }));

    // Map Consultations
    const mappedConsultations: AdminConsultationEntity[] = consultations.map((c) => ({
      id: c.id,
      doctorId: c.doctorId,
      doctorName: c.doctor?.name || "Dr. Assigned",
      doctorSpecialty: c.doctor?.specialty || "General Medicine",
      patientId: c.patientId,
      patientName: c.patient ? `${c.patient.firstName} ${c.patient.lastName}`.trim() : "Patient",
      scheduledAt: c.scheduledAt instanceof Date ? c.scheduledAt.toISOString() : String(c.scheduledAt),
      status: c.status,
      reason: c.reason,
      notes: c.notes,
      prescription: c.prescription,
      durationMinutes: c.duration || 25,
      consultFee: c.doctor?.consultFee ?? 500,
    }));

    // Calculate Stats
    const totalPatients = mappedPatients.length;
    const activePatients = mappedPatients.filter((p) => p.isActive).length;
    const totalDoctors = mappedDoctors.length;
    const activeDoctors = mappedDoctors.filter((d) => d.isActive).length;
    const verifiedDoctors = mappedDoctors.filter((d) => d.isVerified).length;
    const pendingAudits = audits.filter((a) => a.status === "PENDING" || a.status === "UNDER_REVIEW").length;
    const totalConsultations = consultations.length;
    const completedConsultations = consultations.filter((c) => c.status === "COMPLETED").length;

    const stats: AdminSystemStats = {
      totalPatients,
      activePatients,
      totalDoctors,
      activeDoctors,
      verifiedDoctors,
      pendingAudits,
      totalConsultations,
      completedConsultations,
      activeVideoConsultations: activeVideoCount,
    };

    const serializedAudits = audits.map((a) => ({
      ...a,
      submittedAt: a.submittedAt instanceof Date ? a.submittedAt.toISOString() : a.submittedAt,
      updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : a.updatedAt,
    }));

    return {
      success: true,
      stats,
      audits: serializedAudits,
      doctors: mappedDoctors,
      patients: mappedPatients,
      consultations: mappedConsultations,
    };
  } catch (error: any) {
    console.error("getAdminDashboardData error:", error);
    return {
      success: false,
      error: error.message || "Failed to load admin dashboard data.",
    };
  }
}

export async function toggleDoctorStatus(
  doctorId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { isActive },
    });
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update doctor status." };
  }
}

export async function togglePatientStatus(
  patientId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await prisma.patient.update({
      where: { id: patientId },
      data: { isActive },
    });
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update patient status." };
  }
}

export async function toggleDoctorVerification(
  doctorId: string,
  isVerified: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await prisma.doctor.update({
      where: { id: doctorId },
      data: { isVerified },
    });
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to update verification state." };
  }
}

export async function deleteDoctorByAdmin(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await prisma.doctor.delete({
      where: { id: doctorId },
    });
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to remove doctor account." };
  }
}

export async function deletePatientByAdmin(
  patientId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminSession();
    await prisma.patient.delete({
      where: { id: patientId },
    });
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to remove patient account." };
  }
}
