import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";

export const getPatientDashboardData = cache(async () => {
  const session = await requirePatientSession();

  const patient = await prisma.patient.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      countryCode: true,
      dob: true,
      gender: true,
      emailVerified: true,
      createdAt: true,
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
              name: true,
              specialty: true,
            },
          },
        },
      },
    },
  });

  if (!patient) {
    redirect("/signin");
  }

  return {
    session,
    patient,
  };
});
