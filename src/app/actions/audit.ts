"use server";

import { getErrorMessage } from "@/lib/errors";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { mockDb } from "@/lib/mockDb";
import { createAdminClient } from "@/utils/supabase/admin";

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

function isPrismaConnectionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    code?: string;
    name?: string;
    message?: string;
  };

  return (
    maybeError.code === "P1001" ||
    maybeError.name === "PrismaClientInitializationError" ||
    /can't reach database server|connect .*refused|timed out|database server is running/i.test(
      maybeError.message ?? ""
    )
  );
}

async function submitDoctorAuditToSupabase(data: {
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
  const supabase = createAdminClient();

  let linkedDoctorId: string | null = null;
  if (data.doctorEmail) {
    const { data: doctorByEmail, error: emailError } = await supabase
      .from("doctors")
      .select("id")
      .eq("email", data.doctorEmail)
      .maybeSingle();

    if (emailError) {
      throw emailError;
    }

    linkedDoctorId = doctorByEmail?.id ?? null;
  }

  if (!linkedDoctorId) {
    const { data: doctorByNpi, error: npiError } = await supabase
      .from("doctors")
      .select("id")
      .eq("npi", data.npi)
      .maybeSingle();

    if (npiError) {
      throw npiError;
    }

    linkedDoctorId = doctorByNpi?.id ?? null;
  }

  const { data: audit, error: auditError } = await supabase
    .from("doctor_audits")
    .insert({
      doctor_id: linkedDoctorId,
      npi: data.npi,
      first_name: data.firstName || null,
      middle_name: data.middleName || null,
      last_name: data.lastName || null,
      suffix: data.suffix || null,
      license_number: data.licenseNumber,
      license_state: data.licenseState,
      specialty: data.specialty,
      medical_school: data.medicalSchool,
      grad_year: Number(data.gradYear),
      years_exp: Number(data.yearsExp),
      document_name: data.documentName || null,
      approval_type: data.approvalType || "PRC_PRIMARY_SOURCE_VERIFICATION",
      status: "PENDING",
      signature: data.signature,
      consent: data.consent,
    })
    .select("id, status")
    .single();

  if (auditError) {
    throw auditError;
  }

  if (linkedDoctorId) {
    const { error: doctorUpdateError } = await supabase
      .from("doctors")
      .update({
        name: [data.firstName, data.middleName, data.lastName, data.suffix].filter(Boolean).join(" "),
        first_name: data.firstName || null,
        middle_name: data.middleName || null,
        last_name: data.lastName || null,
        suffix: data.suffix || null,
        license_number: data.licenseNumber,
        license_state: data.licenseState,
        years_exp: Number(data.yearsExp),
        specialty: data.specialty,
        is_verified: false,
      })
      .eq("id", linkedDoctorId);

    if (doctorUpdateError) {
      throw doctorUpdateError;
    }
  }

  return {
    success: true,
    auditId: audit.id,
    status: audit.status,
    linked: Boolean(linkedDoctorId),
  };
}

async function approveDoctorAuditWithMockDb(auditId: string) {
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

async function rejectDoctorAuditWithMockDb(auditId: string, reason?: string) {
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
    if (!npi || npi.trim().length < 5) {
      return { success: false, error: "PRC license or registration number is required" };
    }
    if (!licenseNumber || !licenseState) {
      return { success: false, error: "License number and issuing state are required" };
    }
    if (licenseState !== "Philippines") {
      return { success: false, error: "Issuing Medical Board Country must be Philippines" };
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

    try {
      if (isPrismaConfigured()) {
        try {
          // Keep Prisma as a fast path when it is actually reachable.
          const doc = doctorEmail
            ? await prisma.doctor.findUnique({ where: { email: doctorEmail } })
            : await prisma.doctor.findUnique({ where: { npi } });

          const linkedDoctorId = doc?.id ?? null;

          const audit = await prisma.doctorAudit.create({
            data: {
              npi,
              licenseNumber,
              licenseState,
              firstName: firstName || null,
              middleName: middleName || null,
              lastName: lastName || null,
              suffix: suffix || null,
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
                isVerified: false,
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
          if (!isPrismaConnectionError(error)) {
            throw error;
          }
          console.warn("Prisma is unavailable for audit submission. Using Supabase direct client.");
        }
      }

      return await submitDoctorAuditToSupabase(data);
    } catch (error: unknown) {
      console.error("Credentials Audit Error:", error);
      return {
        success: false,
        error: getErrorMessage(error, "Failed to submit credential audit details"),
      };
    }
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
      return approveDoctorAuditWithMockDb(auditId);
    }

    try {
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
      if (isPrismaConnectionError(error)) {
        console.warn("Prisma is unavailable for audit approval. Falling back to mock database.");
        return approveDoctorAuditWithMockDb(auditId);
      }

      throw error;
    }
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
      return rejectDoctorAuditWithMockDb(auditId, reason);
    }

    try {
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
      if (isPrismaConnectionError(error)) {
        console.warn("Prisma is unavailable for audit rejection. Falling back to mock database.");
        return rejectDoctorAuditWithMockDb(auditId, reason);
      }

      throw error;
    }
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

    try {
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
      if (isPrismaConnectionError(error)) {
        console.warn("Prisma is unavailable for pending audit lookup. Falling back to mock database.");
        const audits = mockDb.getPendingDoctorAudits().map((audit) => serializeAudit(audit));
        return {
          success: true,
          audits,
        };
      }

      throw error;
    }
  } catch (error: unknown) {
    console.error("Fetch Pending Audits Error:", error);
    return {
      success: false,
      audits: [],
      error: getErrorMessage(error, "Failed to fetch pending audits"),
    };
  }
}
