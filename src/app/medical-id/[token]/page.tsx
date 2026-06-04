import Link from "next/link";
import { notFound } from "next/navigation";

import { getDoctorSession } from "@/lib/auth/doctor-session";
import { getPatientSession } from "@/lib/auth/patient-session";
import { formatDate } from "@/lib/dashboard/format";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { mockDb } from "@/lib/mockDb";
import { parsePatientMedicalIdToken } from "@/lib/patient-medical-id";

type MedicalIdViewer = {
  role: "patient" | "doctor";
  name: string;
};

type MedicalIdPatient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  dob: string;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  image: string | null;
  height: string | null;
  weight: string | null;
  bloodType: string | null;
  allergies: string | null;
  existingConditions: string | null;
  currentMedications: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  emailVerified: boolean;
  updatedAt: Date;
};

type MedicalIdView = {
  patient: MedicalIdPatient;
  viewer: MedicalIdViewer;
};

function toMedicalIdPatient(patient: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode?: string | null;
  dob: string;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  image?: string | null;
  height?: string | null;
  weight?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  existingConditions?: string | null;
  currentMedications?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  emailVerified: boolean;
  updatedAt: Date | string;
}): MedicalIdPatient {
  return {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    phone: patient.phone,
    countryCode: patient.countryCode || "+1",
    dob: patient.dob,
    gender: patient.gender ?? null,
    address: patient.address ?? null,
    city: patient.city ?? null,
    state: patient.state ?? null,
    zipCode: patient.zipCode ?? null,
    country: patient.country ?? null,
    image: patient.image ?? null,
    height: patient.height ?? null,
    weight: patient.weight ?? null,
    bloodType: patient.bloodType ?? null,
    allergies: patient.allergies ?? null,
    existingConditions: patient.existingConditions ?? null,
    currentMedications: patient.currentMedications ?? null,
    emergencyContactName: patient.emergencyContactName ?? null,
    emergencyContactPhone: patient.emergencyContactPhone ?? null,
    emergencyContactRelation: patient.emergencyContactRelation ?? null,
    emailVerified: patient.emailVerified,
    updatedAt: new Date(patient.updatedAt),
  };
}

async function loadMedicalIdView(token: string): Promise<MedicalIdView | "invalid" | "unauthorized" | "signin"> {
  const payload = parsePatientMedicalIdToken(token);

  if (!payload) {
    return "invalid";
  }

  const patientSession = await getPatientSession();
  const doctorSession = await getDoctorSession();

  if (!patientSession && !doctorSession) {
    return "signin";
  }

  if (!isPrismaConfigured()) {
    const patient = mockDb.findPatientById(payload.patientId);

    if (!patient || new Date(patient.updatedAt).toISOString() !== payload.profileVersion) {
      return "invalid";
    }

    if (patientSession?.userId === patient.id) {
      return {
        viewer: { role: "patient", name: `${patient.firstName} ${patient.lastName}` },
        patient: toMedicalIdPatient(patient),
      };
    }

    if (doctorSession) {
      const doctorBookings = mockDb.getBookingsForDoctor(doctorSession.userId);
      const hasRelationship = doctorBookings.some((booking) => booking.patient?.id === patient.id);

      if (!hasRelationship) {
        return "unauthorized";
      }

      return {
        viewer: { role: "doctor", name: doctorSession.email },
        patient: toMedicalIdPatient(patient),
      };
    }

    return "unauthorized";
  }

  const patient = await prisma.patient.findUnique({
    where: { id: payload.patientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      countryCode: true,
      dob: true,
      gender: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      country: true,
      image: true,
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
      updatedAt: true,
      bookings: {
        orderBy: { scheduledAt: "desc" },
        take: 5,
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          reason: true,
          prescription: true,
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

  if (!patient || patient.updatedAt.toISOString() !== payload.profileVersion) {
    return "invalid";
  }

  if (patientSession?.userId === patient.id) {
    return {
      viewer: { role: "patient", name: `${patient.firstName} ${patient.lastName}` },
      patient: toMedicalIdPatient(patient),
    };
  }

  if (doctorSession) {
    const consultation = await prisma.consultation.findFirst({
      where: {
        doctorId: doctorSession.userId,
        patientId: patient.id,
      },
      select: { id: true },
    });

    if (!consultation) {
      return "unauthorized";
    }

    return {
      viewer: { role: "doctor", name: doctorSession.email },
      patient: toMedicalIdPatient(patient),
    };
  }

  return "unauthorized";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <dt className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</dt>
      <dd className="mt-2 text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

export default async function MedicalIdPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await loadMedicalIdView(token);

  if (view === "invalid") {
    notFound();
  }

  if (view === "signin") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-3xl items-center">
          <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-brand-teal">Secure access required</p>
            <h1 className="mt-3 text-3xl font-black text-white">Sign in to view this medical QR record</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-300">
              This QR code opens a signed patient profile page. To protect sensitive medical information, you need an authenticated patient or doctor session before the record can be displayed.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/signin" className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-white">
                Patient sign in
              </Link>
              <Link href="/doctor/signin" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-black text-white">
                Doctor sign in
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (view === "unauthorized") {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-12 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-3xl items-center">
          <section className="w-full rounded-3xl border border-red-500/20 bg-red-500/10 p-8 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-red-300">Access denied</p>
            <h1 className="mt-3 text-3xl font-black text-white">This secure record cannot be viewed by the current session</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-red-100/80">
              The QR token is valid, but the current signed-in account is not authorized to see this patient record. If you believe you should have access, open the QR from the correct patient session or consult the care team.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const { patient, viewer } = view;
  const fullName = `${patient.firstName} ${patient.lastName}`;
  const address = [patient.address, patient.city, patient.state, patient.zipCode, patient.country].filter(Boolean).join(", ");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-brand-teal to-cyan-500 px-8 py-6 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-white/80">HealthKo Medical QR</p>
            <h1 className="mt-3 text-3xl font-black">{fullName}</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-white/85">
              Authorized viewer: <span className="font-black">{viewer.role === "doctor" ? "Doctor" : "Patient"}</span>
              {" "} - record last synced {formatDate(patient.updatedAt)}
            </p>
          </div>

          <div className="grid gap-4 px-8 py-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <InfoRow label="Full name" value={fullName} />
              <InfoRow label="Date of birth" value={patient.dob} />
              <InfoRow label="Gender" value={patient.gender || "Not specified"} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Phone" value={`${patient.countryCode || ""} ${patient.phone}`.trim()} />
              <InfoRow label="Blood type" value={patient.bloodType || "Not recorded"} />
              <InfoRow label="Height" value={patient.height || "Not recorded"} />
              <InfoRow label="Weight" value={patient.weight || "Not recorded"} />
              <div className="sm:col-span-2 xl:col-span-3">
                <InfoRow label="Address" value={address || "No address on file"} />
              </div>
            </div>

            <aside className="grid gap-4">
              <div className="rounded-3xl border border-brand-teal/15 bg-brand-teal/5 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Emergency Contact</p>
                <p className="mt-3 text-lg font-black text-slate-950">{patient.emergencyContactName || "Not recorded"}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {patient.emergencyContactRelation || "Relation not recorded"}
                </p>
                <p className="mt-4 text-sm font-semibold text-slate-700">
                  {patient.emergencyContactPhone || "Phone not recorded"}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Medical Notes</p>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-black uppercase text-slate-400">Allergies</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{patient.allergies || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-black uppercase text-slate-400">Existing conditions</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{patient.existingConditions || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-black uppercase text-slate-400">Current medications</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{patient.currentMedications || "Not recorded"}</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        </section>
        {/* Removed secondary panels to keep the scan result focused on patient identity and medical details. */}
      </div>
    </main>
  );
}
