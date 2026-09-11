import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";

const PATIENT_BOOKINGS_SELECT = {
  orderBy: { scheduledAt: "asc" as const },
  select: {
    id: true,
    scheduledAt: true,
    status: true,
    reason: true,
    duration: true,
    prescription: true,
    bloodPressure: true,
    heartRate: true,
    bodyTemperature: true,
    createdAt: true,
    doctor: {
      select: {
        id: true,
        name: true,
        specialty: true,
        licenseNumber: true,
        licenseState: true,
        npi: true,
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
  medicalCertificates: {
    orderBy: { issuedAt: "desc" as const },
    select: {
      id: true,
      certNumber: true,
      purpose: true,
      diagnosis: true,
      remarks: true,
      restDaysFrom: true,
      restDaysTo: true,
      issuedAt: true,
      consultationId: true,
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
  },
};

export const getPatientDashboardData = cache(async () => {
  const session = await requirePatientSession();

  const patient = await prisma.patient.findUnique({
    where: { id: session.userId },
    select: PATIENT_PROFILE_SELECT,
  });

  if (!patient) {
    redirect("/signin");
  }

  return { session, patient };
});
