import { getDoctorDashboardData } from "@/lib/dal/doctor";
import { getDoctorsList } from "@/app/actions/patient";
import type { DashboardDoctor, DoctorAppointment, DoctorModuleId } from "@/lib/dashboard/types";
import DoctorDashboardClient from "./DoctorDashboardClient";

const DOCTOR_MODULES = [
  "overview",
  "live",
  "patients",
  "schedule",
  "notes",
  "prescriptions",
  "messages",
  "notifications",
  "analytics",
  "research",
  "settings",
] as const satisfies readonly DoctorModuleId[];

function getInitialModule(moduleParam?: string | string[]) {
  const moduleValue = Array.isArray(moduleParam) ? moduleParam[0] : moduleParam;
  return moduleValue && DOCTOR_MODULES.includes(moduleValue as DoctorModuleId)
    ? (moduleValue as DoctorModuleId)
    : "overview";
}

export default async function DoctorDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const { session, doctor } = await getDoctorDashboardData();
  const doctorsRes = await getDoctorsList();
  const params = await searchParams;
  const initialModule = getInitialModule(params?.module);

  // Serialize models correctly for client component boundary
  const doctorBookings = ((doctor as any)?.bookings ?? []) as DoctorAppointment[];
  const serializedDoctor = {
    ...doctor,
    bookings: doctorBookings
      .filter((booking: DoctorAppointment) => booking.patient !== null && booking.patient !== undefined)
      .map((booking: DoctorAppointment) => ({
        ...booking,
        scheduledAt: new Date(booking.scheduledAt),
        createdAt: new Date(booking.createdAt),
        videoSession: booking.videoSession ? {
          ...booking.videoSession,
          startedAt: booking.videoSession.startedAt ? new Date(booking.videoSession.startedAt) : null,
          endedAt: booking.videoSession.endedAt ? new Date(booking.videoSession.endedAt) : null,
        } : null,
        patient: {
          id: booking.patient!.id,
          firstName: booking.patient!.firstName,
          lastName: booking.patient!.lastName,
          email: booking.patient!.email,
          image: booking.patient!.image ?? null,
          phone: booking.patient!.phone,
          countryCode: booking.patient!.countryCode ?? "+1",
          dob: booking.patient!.dob,
          gender: booking.patient!.gender,
          address: booking.patient!.address ?? null,
          city: booking.patient!.city ?? null,
          state: booking.patient!.state ?? null,
          zipCode: booking.patient!.zipCode ?? null,
          country: booking.patient!.country ?? null,
          height: booking.patient!.height ?? null,
          weight: booking.patient!.weight ?? null,
          bloodType: booking.patient!.bloodType ?? null,
          allergies: booking.patient!.allergies ?? null,
          existingConditions: booking.patient!.existingConditions ?? null,
          currentMedications: booking.patient!.currentMedications ?? null,
          emergencyContactName: booking.patient!.emergencyContactName ?? null,
          emergencyContactPhone: booking.patient!.emergencyContactPhone ?? null,
          emergencyContactRelation: booking.patient!.emergencyContactRelation ?? null,
          emailVerified: booking.patient!.emailVerified,
        },
      })),
    audits: ((doctor as any)?.audits ?? []).map((audit: any) => ({
      ...audit,
      submittedAt: new Date(audit.submittedAt),
      updatedAt: new Date(audit.updatedAt),
    })),
    createdAt: new Date((doctor as any)?.createdAt ?? Date.now()),
    consultFee: (doctor as any)?.consultFee !== null && (doctor as any)?.consultFee !== undefined ? Number((doctor as any).consultFee) : null,
    yearsExp: (doctor as any)?.yearsExp !== null && (doctor as any)?.yearsExp !== undefined ? Number((doctor as any).yearsExp) : null,
    consultationDuration: (doctor as any)?.consultationDuration !== null && (doctor as any)?.consultationDuration !== undefined ? Number((doctor as any).consultationDuration) : 30,
  };

  const doctors = (doctorsRes.success ? doctorsRes.doctors || [] : [])
    .filter((candidate: DashboardDoctor) => candidate.id !== doctor.id)
    .map((candidate: DashboardDoctor) => ({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      npi: candidate.npi,
      specialty: candidate.specialty,
      bio: candidate.bio,
      image: candidate.image,
      availability: candidate.availability,
      status: candidate.status,
      consultFee: candidate.consultFee !== null ? Number(candidate.consultFee) : null,
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
      isVerified: candidate.isVerified,
      licenseNumber: candidate.licenseNumber,
      licenseState: candidate.licenseState,
      yearsExp: candidate.yearsExp,
    }));

  return <DoctorDashboardClient doctor={serializedDoctor as any} doctors={doctors} initialModule={initialModule} currentSessionId={session.sessionId} />;
}
