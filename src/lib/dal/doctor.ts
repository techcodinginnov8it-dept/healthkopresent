import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireDoctorSession } from "@/lib/auth/doctor-session";

export const getDoctorDashboardData = cache(async () => {
  const session = await requireDoctorSession();

  const doctor = await prisma.doctor.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      npi: true,
      specialty: true,
      bio: true,
      image: true,
      licenseNumber: true,
      licenseState: true,
      yearsExp: true,
      consultFee: true,
      consultationDuration: true,
      consultationDurationUnit: true,
      rating: true,
      reviewCount: true,
      availability: true,
      status: true,
      isVerified: true,
      createdAt: true,
      medicalCertificates: {
        orderBy: { issuedAt: "desc" },
        select: {
          id: true,
          certNumber: true,
          purpose: true,
          diagnosis: true,
          remarks: true,
          restDaysFrom: true,
          restDaysTo: true,
          issuedAt: true,
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
      bookings: {
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          reason: true,
          notes: true,
          prescription: true,
          bloodPressure: true,
          heartRate: true,
          bodyTemperature: true,
          duration: true,
          createdAt: true,
          videoSession: {
            select: {
              id: true,
              status: true,
              roomId: true,
              startedAt: true,
              endedAt: true,
            },
          },
          patient: {
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
            },
          },
        },
      },
      audits: {
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          licenseNumber: true,
          licenseState: true,
        },
      },
    },
  });

  if (!doctor) {
    redirect("/doctor/signin");
  }

  return { session, doctor };
});
