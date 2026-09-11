"use server";

import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";

export async function getPatientMedicalCertificates() {
  try {
    const session = await requirePatientSession();

    const certificates = await prisma.medicalCertificate.findMany({
      where: { patientId: session.userId },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialty: true,
            licenseNumber: true,
            npi: true,
          },
        },
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
      },
      orderBy: { issuedAt: "desc" },
    });

    return { success: true, certificates };
  } catch (error: unknown) {
    console.error("getPatientMedicalCertificates failed:", error);
    return { success: false, error: "Failed to fetch medical certificates.", certificates: [] };
  }
}
