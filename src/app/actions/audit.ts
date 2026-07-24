"use server";

import { getErrorMessage } from "@/lib/errors";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { mockDb } from "@/lib/mockDb";
import { createAdminClient } from "@/utils/supabase/admin";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

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
  doctorEmail?: string | null;
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
    doctorEmail: audit.doctorEmail ?? null,
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
      doctor_email: data.doctorEmail || null,
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
              doctorEmail: doctorEmail || null,
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
      // Last resort: fall back to mockDb so submissions still work in dev/offline mode
      console.warn("Supabase unavailable for audit submission. Falling back to mock database.");
      try {
        const mockAudit = mockDb.createDoctorAudit({
          doctorId: null,
          npi: data.npi,
          firstName: data.firstName || null,
          middleName: data.middleName || null,
          lastName: data.lastName || null,
          suffix: data.suffix || null,
          licenseNumber: data.licenseNumber,
          licenseState: data.licenseState,
          specialty: data.specialty,
          medicalSchool: data.medicalSchool,
          gradYear: Number(data.gradYear),
          yearsExp: Number(data.yearsExp),
          documentName: data.documentName || null,
          approvalType: data.approvalType || "PRC_PRIMARY_SOURCE_VERIFICATION",
          status: "PENDING",
          signature: data.signature,
          consent: data.consent,
          doctorEmail: data.doctorEmail || null,
        });
        return {
          success: true,
          auditId: mockAudit.id,
          status: mockAudit.status,
          linked: false,
        };
      } catch (mockErr: unknown) {
        console.error("MockDb audit creation error:", mockErr);
        return {
          success: false,
          error: getErrorMessage(error, "Failed to submit credential audit details"),
        };
      }
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

export async function getAllDoctorAudits() {
  try {
    if (!isPrismaConfigured()) {
      const audits = mockDb.getAllDoctorAudits().map((audit) => serializeAudit(audit));
      return { success: true, audits };
    }

    try {
      const audits = await prisma.doctorAudit.findMany({
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

      return { success: true, audits: audits.map(serializeAudit) };
    } catch (error: unknown) {
      if (isPrismaConnectionError(error)) {
        console.warn("Prisma unavailable for all audits lookup. Falling back to mock database.");
        const audits = mockDb.getAllDoctorAudits().map((audit) => serializeAudit(audit));
        return { success: true, audits };
      }
      throw error;
    }
  } catch (error: unknown) {
    console.error("Fetch All Audits Error:", error);
    return {
      success: false,
      audits: [],
      error: getErrorMessage(error, "Failed to fetch audits"),
    };
  }
}


export type CreateDoctorAccountPayload = {
  email: string;
  password: string;
  npi: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  specialty: string;
  licenseNumber: string;
  licenseState: string;
  yearsExp?: number;
  consultFee?: number;
  auditId?: string;
};

export async function createDoctorAccountByAdmin(data: CreateDoctorAccountPayload) {
  try {
    const {
      email,
      password,
      npi,
      firstName,
      middleName,
      lastName,
      suffix,
      specialty,
      licenseNumber,
      licenseState,
      yearsExp = 5,
      consultFee = 500,
      auditId,
    } = data;

    const normalizedEmail = email.trim().toLowerCase();
    const cleanNpi = npi.trim();

    if (!normalizedEmail || !password || !cleanNpi || !firstName || !lastName || !specialty || !licenseNumber || !licenseState) {
      return { success: false, error: "Please fill in all required doctor account fields." };
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    const fullName = [firstName, middleName, lastName, suffix].filter((part) => part && part.trim().length > 0).join(" ").trim();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 1: Attempt creation in Prisma if configured
    if (isPrismaConfigured()) {
      try {
        const createdAccount = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const user = await tx.user.upsert({
            where: { email: normalizedEmail },
            create: {
              email: normalizedEmail,
              password: hashedPassword,
              role: "DOCTOR",
              emailVerified: true,
              isActive: true,
            },
            update: {
              password: hashedPassword,
              role: "DOCTOR",
              emailVerified: true,
              isActive: true,
            },
          });

          const doctor = await tx.doctor.upsert({
            where: { email: normalizedEmail },
            create: {
              userId: user.id,
              name: fullName || `Dr. ${lastName}`,
              firstName: firstName || null,
              middleName: middleName || null,
              lastName: lastName || null,
              suffix: suffix || null,
              npi: cleanNpi,
              email: normalizedEmail,
              password: hashedPassword,
              specialty,
              licenseNumber,
              licenseState,
              yearsExp: Number(yearsExp),
              consultFee: Number(consultFee),
              isVerified: true,
              isActive: true,
            },
            update: {
              userId: user.id,
              name: fullName || `Dr. ${lastName}`,
              firstName: firstName || null,
              middleName: middleName || null,
              lastName: lastName || null,
              suffix: suffix || null,
              npi: cleanNpi,
              password: hashedPassword,
              specialty,
              licenseNumber,
              licenseState,
              yearsExp: Number(yearsExp),
              consultFee: Number(consultFee),
              isVerified: true,
              isActive: true,
            },
          });

          if (auditId) {
            await tx.doctorAudit.update({
              where: { id: auditId },
              data: {
                status: "APPROVED",
                doctorId: doctor.id,
              },
            }).catch((err: unknown) => console.warn("Audit update failed inside transaction:", err));
          }

          return doctor;
        });

        return {
          success: true,
          message: `Doctor account for Dr. ${fullName || lastName} created and verified successfully!`,
          doctor: {
            id: createdAccount.id,
            name: createdAccount.name,
            email: createdAccount.email,
            npi: createdAccount.npi,
            specialty: createdAccount.specialty,
          },
        };
      } catch (error: unknown) {
        if (!isPrismaConnectionError(error)) {
          console.error("Prisma doctor creation error:", error);
          return { success: false, error: getErrorMessage(error, "Failed to create doctor account in Prisma database") };
        }
        console.warn("Prisma unavailable for doctor creation. Falling back to MockDB.");
      }
    }

    // Step 2: Fallback to MockDB
    const existingDoctor = mockDb.findDoctorByEmailOrNpi(normalizedEmail) || mockDb.findDoctorByEmailOrNpi(cleanNpi);
    if (existingDoctor) {
      mockDb.updateDoctor(existingDoctor.id, {
        password: hashedPassword,
        name: fullName || existingDoctor.name,
        firstName: firstName || existingDoctor.firstName,
        middleName: middleName || existingDoctor.middleName,
        lastName: lastName || existingDoctor.lastName,
        suffix: suffix || existingDoctor.suffix,
        npi: cleanNpi,
        specialty,
        licenseNumber,
        licenseState,
        yearsExp: Number(yearsExp),
        isVerified: true,
        isActive: true,
      });

      if (auditId) {
        mockDb.updateDoctorAudit(auditId, { status: "APPROVED" });
      }

      return {
        success: true,
        message: `Doctor account for Dr. ${fullName || lastName} updated and verified in system!`,
        doctor: {
          id: existingDoctor.id,
          name: fullName || existingDoctor.name,
          email: normalizedEmail,
          npi: cleanNpi,
          specialty,
        },
      };
    }

    const newDoctor = mockDb.createDoctor({
      name: fullName || `Dr. ${lastName}`,
      firstName: firstName || null,
      middleName: middleName || null,
      lastName: lastName || null,
      suffix: suffix || null,
      npi: cleanNpi,
      email: normalizedEmail,
      password: hashedPassword,
      specialty,
      licenseNumber,
      licenseState,
      yearsExp: Number(yearsExp),
      consultFee: Number(consultFee),
      isVerified: true,
      isActive: true,
    });

    if (auditId) {
      mockDb.updateDoctorAudit(auditId, { status: "APPROVED" });
    }

    return {
      success: true,
      message: `Doctor account for Dr. ${fullName || lastName} created successfully!`,
      doctor: {
        id: newDoctor.id,
        name: newDoctor.name,
        email: newDoctor.email,
        npi: newDoctor.npi,
        specialty: newDoctor.specialty,
      },
    };
  } catch (error: unknown) {
    console.error("Create Doctor Account Error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "An unexpected error occurred while creating the doctor account."),
    };
  }
}
