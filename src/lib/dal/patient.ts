import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { mockDb } from "@/lib/mockDb";

const PATIENT_BOOKINGS_SELECT = {
  orderBy: { scheduledAt: "asc" as const },
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
    // Include active video session so the patient dashboard can hydrate
    // authorizedRooms on page load without needing a socket event.
    videoSession: {
      select: {
        roomId: true,
        status: true,
      },
    },
  },
};

const PATIENT_PROFILE_SELECT = {
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
  bookings: PATIENT_BOOKINGS_SELECT,
};

export const getPatientDashboardData = cache(async () => {
  const session = await requirePatientSession();

  if (!isPrismaConfigured()) {
    return getMockPatientDashboardData(session);
  }

  let patient = null;

  try {
    patient = await prisma.patient.findUnique({
      where: { id: session.userId },
      select: PATIENT_PROFILE_SELECT,
    });
  } catch (error) {
    console.error("[getPatientDashboardData] Prisma query failed:", error);
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
    const patientData = mockDb.findPatientById(session.userId) ?? mockDb.findPatientByEmail(session.email);

    if (!patientData) {
      redirect("/signin");
    }

    return {
      session,
      patient: {
        id: patientData.id,
        firstName: patientData.firstName,
        middleName: patientData.middleName,
        lastName: patientData.lastName,
        suffix: patientData.suffix,
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
        bookings: mockDb.getBookingsForPatient(patientData.id),
      },
    };
  } catch (mockErr) {
    console.error("Patient DAL Mock DB critical failure:", mockErr);
    redirect("/signin");
  }
}
