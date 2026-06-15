import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { mockDb } from "@/lib/mockDb";

export const getPatientDashboardData = cache(async () => {
  const session = await requirePatientSession();

  if (!isPrismaConfigured()) {
    return getMockPatientDashboardData(session);
  }

  let patient = null;
  let queryError = false;

  try {
    patient = await prisma.patient.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        image: true,
        phone: true,
        countryCode: true,
        dob: true,
        gender: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        height: true,
        weight: true,
        bloodType: true,
        allergies: true,
        existingConditions: true,
        currentMedications: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        bookings: {
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            reason: true,
            duration: true,
            prescription: true,
            createdAt: true,
            doctor: {
              select: {
                id: true,
                name: true,
                specialty: true,
              },
            },
          },
        },
      },
    });

    if (!patient) {
      // Patient not found in Postgres. Attempt to sync from mockDb on the fly!
      const mockPatient = mockDb.findPatientById(session.userId) || mockDb.findPatientByEmail(session.email);
      if (mockPatient) {
        console.log(`[getPatientDashboardData] Syncing mock patient "${mockPatient.email}" to Postgres on the fly...`);
        await prisma.patient.create({
          data: {
            id: session.userId,
            firstName: mockPatient.firstName,
            middleName: mockPatient.middleName,
            lastName: mockPatient.lastName,
            suffix: mockPatient.suffix,
            email: mockPatient.email,
            countryCode: mockPatient.countryCode,
            phone: mockPatient.phone,
            dob: mockPatient.dob,
            gender: mockPatient.gender,
            password: mockPatient.password,
            hipaaConsent: mockPatient.hipaaConsent,
            emailVerified: mockPatient.emailVerified,
            isActive: mockPatient.isActive,
          },
        });

        // Re-query the synced patient
        patient = await prisma.patient.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
            phone: true,
            countryCode: true,
            dob: true,
            gender: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            country: true,
            height: true,
            weight: true,
            bloodType: true,
            allergies: true,
            existingConditions: true,
            currentMedications: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            emergencyContactRelation: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
            bookings: {
              orderBy: { scheduledAt: "asc" },
              select: {
                id: true,
                scheduledAt: true,
                status: true,
                reason: true,
                duration: true,
                prescription: true,
                createdAt: true,
                doctor: {
                  select: {
                    id: true,
                    name: true,
                    specialty: true,
                  },
                },
              },
            },
          },
        });
      }
    }
  } catch (error) {
    console.error("Prisma getPatientDashboardData failed:", error);
    throw error;
  }

  if (!patient) {
    redirect("/signin");
  }

  return {
    session,
    patient,
  };
});

function getMockPatientDashboardData(session: { userId: string; email: string }) {
  try {
    const patientData = mockDb.findPatientById(session.userId);
    if (!patientData) {
      redirect("/signin");
    }

    const bookings = mockDb.getBookingsForPatient(session.userId);

    return {
      session,
      patient: {
        id: patientData.id,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        email: patientData.email,
        image: patientData.image ?? null,
        phone: patientData.phone,
        countryCode: patientData.countryCode,
        dob: patientData.dob,
        gender: patientData.gender,
        address: patientData.address ?? null,
        city: patientData.city ?? null,
        state: patientData.state ?? null,
        zipCode: patientData.zipCode ?? null,
        country: patientData.country ?? null,
        height: patientData.height ?? null,
        weight: patientData.weight ?? null,
        bloodType: patientData.bloodType ?? null,
        allergies: patientData.allergies ?? null,
        existingConditions: patientData.existingConditions ?? null,
        currentMedications: patientData.currentMedications ?? null,
        emergencyContactName: patientData.emergencyContactName ?? null,
        emergencyContactPhone: patientData.emergencyContactPhone ?? null,
        emergencyContactRelation: patientData.emergencyContactRelation ?? null,
        emailVerified: patientData.emailVerified,
        createdAt: new Date(patientData.createdAt),
        updatedAt: new Date(patientData.updatedAt),
        bookings,
      },
    };
  } catch (mockErr) {
    console.error("Patient DAL Mock DB critical failure:", mockErr);
    redirect("/signin");
  }
}
