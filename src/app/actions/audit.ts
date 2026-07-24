"use server";

import { getErrorMessage } from "@/lib/errors";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { mockDb } from "@/lib/mockDb";

function serializeAudit(audit: {
  id: string;
  doctorId: string | null;
  npi: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  documentName: string | null;
  approvalType?: string;
  status: string;
  signature: string;
  consent: boolean;
  submittedAt: Date | string;
  updatedAt: Date | string;
  doctor?: {
    id: string;
    name: string;
    email: string;
    specialty: string;
  } | null;
}) {
  return {
    ...audit,
    doctor: audit.doctor ?? null,
    submittedAt: audit.submittedAt instanceof Date ? audit.submittedAt.toISOString() : audit.submittedAt,
    updatedAt: audit.updatedAt instanceof Date ? audit.updatedAt.toISOString() : audit.updatedAt,
  };
}

export async function submitDoctorAudit(data: {
  npi: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  documentName?: string;
  approvalType?: string;
  signature: string;
  consent: boolean;
  doctorEmail?: string;
}) {
  try {
    const {
      npi,
      firstName,
      middleName,
      lastName,
      suffix,
      licenseNumber,
      licenseState,
      specialty,
      medicalSchool,
      gradYear,
      yearsExp,
      documentName,
      approvalType,
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
    // Try to find the doctor using either the provided email or NPI
    let linkedDoctorId: string | null = null;
    if (isPrismaConfigured()) {
      if (doctorEmail) {
        const doc = await prisma.doctor.findUnique({ where: { email: doctorEmail } });
        if (doc) linkedDoctorId = doc.id;
      }
      if (!linkedDoctorId) {
        const doc = await prisma.doctor.findUnique({ where: { npi } });
        if (doc) linkedDoctorId = doc.id;
      }
    } else if (doctorEmail) {
      const doc = mockDb.findDoctorByEmailOrNpi(doctorEmail);
      if (doc) linkedDoctorId = doc.id;
    }
    if (!linkedDoctorId) {
      const doc = isPrismaConfigured() ? await prisma.doctor.findUnique({ where: { npi } }) : mockDb.findDoctorByEmailOrNpi(npi);
      if (doc) linkedDoctorId = doc.id;
    }

    if (!isPrismaConfigured()) {
      const audit = mockDb.createDoctorAudit({
        doctorId: linkedDoctorId,
        npi,
        firstName: firstName || null,
        middleName: middleName || null,
        lastName: lastName || null,
        suffix: suffix || null,
        licenseNumber,
        licenseState,
        specialty,
        medicalSchool,
        gradYear: Number(gradYear),
        yearsExp: Number(yearsExp),
        documentName: documentName || null,
        approvalType: approvalType || "PRC_PRIMARY_SOURCE_VERIFICATION",
        status: "PENDING",
        signature,
        consent,
      });

      return {
        success: true,
        auditId: audit.id,
        status: audit.status,
        linked: !!linkedDoctorId,
      };
    }

    // Create the credentials audit record in the database
    const audit = await prisma.doctorAudit.create({
      data: {
        npi,
        firstName: firstName || null,
        middleName: middleName || null,
        lastName: lastName || null,
        suffix: suffix || null,
        licenseNumber,
        licenseState,
        specialty,
        medicalSchool,
        gradYear: Number(gradYear),
        yearsExp: Number(yearsExp),
        documentName: documentName || null,
        approvalType: approvalType || "PRC_PRIMARY_SOURCE_VERIFICATION",
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
          name: [firstName, middleName, lastName, suffix].filter(Boolean).join(" "),
          firstName: firstName || null,
          middleName: middleName || null,
          lastName: lastName || null,
          suffix: suffix || null,
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
      const audit = mockDb.findDoctorAuditById(auditId);

      if (!audit) {
        return { success: false, error: "Audit record not found" };
      }

      if (audit.status === "APPROVED") {
        return { success: false, error: "This audit is already approved" };
      }

      const updatedAudit = mockDb.updateDoctorAudit(auditId, { status: "APPROVED" });

      if (!updatedAudit) {
        return { success: false, error: "Audit record not found" };
      }

      if (audit.doctorId) {
        mockDb.updateDoctor(audit.doctorId, {
          isVerified: true,
          isActive: true,
        });
      }

      return {
        success: true,
        message: "Doctor credentials approved successfully",
        auditId: updatedAudit.id,
        status: updatedAudit.status,
      };
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
      const audit = mockDb.findDoctorAuditById(auditId);

      if (!audit) {
        return { success: false, error: "Audit record not found" };
      }

      if (audit.status === "REJECTED") {
        return { success: false, error: "This audit is already rejected" };
      }

      const updatedAudit = mockDb.updateDoctorAudit(auditId, { status: "REJECTED" });

      if (!updatedAudit) {
        return { success: false, error: "Audit record not found" };
      }

      if (audit.doctorId) {
        mockDb.updateDoctor(audit.doctorId, { isVerified: false });
      }

      return {
        success: true,
        message: reason ? `Rejected: ${reason}` : "Doctor credentials rejected",
        auditId: updatedAudit.id,
        status: updatedAudit.status,
      };
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
      const audits = mockDb.getPendingDoctorAudits().map((audit) => serializeAudit(audit));
      return {
        success: true,
        audits,
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
      audits: audits.map(serializeAudit),
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
