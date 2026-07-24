"use server";

import { getErrorMessage } from "@/lib/errors";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { mockDb } from "@/lib/mockDb";

export async function submitDoctorAudit(data: {
  npi: string;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  documentName?: string;
  signature: string;
  consent: boolean;
  doctorEmail?: string;
}) {
  try {
    const {
      npi,
      licenseNumber,
      licenseState,
      specialty,
      medicalSchool,
      gradYear,
      yearsExp,
      documentName,
      signature,
      consent,
      doctorEmail,
    } = data;

    // Validate parameters
    if (!npi || npi.length !== 10 || isNaN(Number(npi))) {
      return { success: false, error: "NPI must be a valid 10-digit number" };
    }
    if (!licenseNumber || !licenseState) {
      return { success: false, error: "License number and issuing state are required" };
    }
    if (!specialty) {
      return { success: false, error: "Specialty is required" };
    }
    if (!medicalSchool || !gradYear || !yearsExp) {
      return { success: false, error: "Medical credentials are incomplete" };
    }
    if (!signature || !consent) {
      return { success: false, error: "Legal consent and digital signature are required" };
    }

    // In development without Prisma, create a mock audit submission
    if (!isPrismaConfigured()) {
      const mockAuditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.warn(
        "[Audit] Prisma not configured - creating mock audit submission",
        { mockAuditId, npi, specialty }
      );
      return {
        success: true,
        auditId: mockAuditId,
        status: "PENDING",
        linked: false,
      };
    }

    // Try to find the doctor using either the provided email or NPI
    let linkedDoctorId: string | null = null;
    if (doctorEmail) {
      const doc = await prisma.doctor.findUnique({ where: { email: doctorEmail } });
      if (doc) linkedDoctorId = doc.id;
    }
    if (!linkedDoctorId) {
      const doc = await prisma.doctor.findUnique({ where: { npi } });
      if (doc) linkedDoctorId = doc.id;
    }

    // Create the credentials audit record in the database
    const audit = await prisma.doctorAudit.create({
      data: {
        npi,
        licenseNumber,
        licenseState,
        specialty,
        medicalSchool,
        gradYear: Number(gradYear),
        yearsExp: Number(yearsExp),
        documentName: documentName || null,
        signature,
        consent,
        status: "PENDING",
        doctorId: linkedDoctorId,
      },
    });

    // If a doctor is linked, update their profile flags to reflect that credentials are under audit
    if (linkedDoctorId) {
      await prisma.doctor.update({
        where: { id: linkedDoctorId },
        data: {
          licenseNumber,
          licenseState,
          yearsExp: Number(yearsExp),
          specialty,
          isVerified: false, // Reset verification status during audit
        },
      });
    }

    return {
      success: true,
      auditId: audit.id,
      status: audit.status,
      linked: !!linkedDoctorId,
    };
  } catch (error: unknown) {
    console.error("Credentials Audit Error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Failed to submit credential audit details"),
    };
  }
}

export async function approveDoctorAudit(auditId: string) {
  try {
    if (!auditId) {
      return { success: false, error: "Audit ID is required" };
    }

    if (!isPrismaConfigured()) {
      return { success: false, error: "Database configuration is not available. Please contact support." };
    }

    const audit = await prisma.doctorAudit.findUnique({
      where: { id: auditId },
    });

    if (!audit) {
      return { success: false, error: "Audit record not found" };
    }

    if (audit.status === "APPROVED") {
      return { success: false, error: "This audit is already approved" };
    }

    const updatedAudit = await prisma.doctorAudit.update({
      where: { id: auditId },
      data: { status: "APPROVED" },
    });

    // If a doctor is linked, mark them as verified and active
    if (audit.doctorId) {
      await prisma.doctor.update({
        where: { id: audit.doctorId },
        data: {
          isVerified: true,
          isActive: true,
        },
      });
    }

    return {
      success: true,
      message: "Doctor credentials approved successfully",
      auditId: updatedAudit.id,
      status: updatedAudit.status,
    };
  } catch (error: unknown) {
    console.error("Doctor Audit Approval Error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Failed to approve doctor credentials"),
    };
  }
}

export async function rejectDoctorAudit(auditId: string, reason?: string) {
  try {
    if (!auditId) {
      return { success: false, error: "Audit ID is required" };
    }

    if (!isPrismaConfigured()) {
      return { success: false, error: "Database configuration is not available. Please contact support." };
    }

    const audit = await prisma.doctorAudit.findUnique({
      where: { id: auditId },
    });

    if (!audit) {
      return { success: false, error: "Audit record not found" };
    }

    if (audit.status === "REJECTED") {
      return { success: false, error: "This audit is already rejected" };
    }

    const updatedAudit = await prisma.doctorAudit.update({
      where: { id: auditId },
      data: { status: "REJECTED" },
    });

    // If a doctor is linked, mark them as not verified
    if (audit.doctorId) {
      await prisma.doctor.update({
        where: { id: audit.doctorId },
        data: { isVerified: false },
      });
    }

    return {
      success: true,
      message: reason ? `Rejected: ${reason}` : "Doctor credentials rejected",
      auditId: updatedAudit.id,
      status: updatedAudit.status,
    };
  } catch (error: unknown) {
    console.error("Doctor Audit Rejection Error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Failed to reject doctor credentials"),
    };
  }
}

export async function getPendingDoctorAudits() {
  try {
    if (!isPrismaConfigured()) {
      // Return empty array for mock DB (not implemented yet)
      return {
        success: true,
        audits: [],
      };
    }

    const audits = await prisma.doctorAudit.findMany({
      where: { status: "PENDING" },
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
      orderBy: { submittedAt: "desc" },
    });

    return {
      success: true,
      audits,
    };
  } catch (error: unknown) {
    console.error("Fetch Pending Audits Error:", error);
    return {
      success: false,
      audits: [],
      error: getErrorMessage(error, "Failed to fetch pending audits"),
    };
  }
}
