import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/lib/dashboard/format";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { mockDb } from "@/lib/mockDb";
import { parsePatientMedicalIdToken } from "@/lib/patient-medical-id";

type EmergencyPatient = {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string | null;
  bloodType: string | null;
  height: string | null;
  weight: string | null;
  allergies: string | null;
  existingConditions: string | null;
  currentMedications: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  phone: string;
  countryCode: string | null;
  updatedAt: Date;
};

async function loadEmergencyPatient(token: string): Promise<EmergencyPatient | null> {
  const payload = parsePatientMedicalIdToken(token);
  if (!payload) return null;

  if (isPrismaConfigured()) {
    try {
      const patient = await prisma.patient.findUnique({
        where: { id: payload.patientId },
        select: {
          firstName: true,
          lastName: true,
          dob: true,
          gender: true,
          bloodType: true,
          height: true,
          weight: true,
          allergies: true,
          existingConditions: true,
          currentMedications: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
          emergencyContactRelation: true,
          phone: true,
          countryCode: true,
          updatedAt: true,
        },
      });

      if (patient) {
        return {
          firstName: patient.firstName,
          lastName: patient.lastName,
          dob: patient.dob,
          gender: patient.gender ?? null,
          bloodType: patient.bloodType ?? null,
          height: patient.height ?? null,
          weight: patient.weight ?? null,
          allergies: patient.allergies ?? null,
          existingConditions: patient.existingConditions ?? null,
          currentMedications: patient.currentMedications ?? null,
          emergencyContactName: patient.emergencyContactName ?? null,
          emergencyContactPhone: patient.emergencyContactPhone ?? null,
          emergencyContactRelation: patient.emergencyContactRelation ?? null,
          phone: patient.phone,
          countryCode: patient.countryCode ?? null,
          updatedAt: new Date(patient.updatedAt),
        };
      }
    } catch (error) {
      console.warn("Prisma query in loadEmergencyPatient failed, falling back to mock JSON database:", error);
    }
  }

  // Fallback to mockDb
  const patient = mockDb.findPatientById(payload.patientId);
  if (!patient) return null;
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dob: patient.dob,
    gender: patient.gender ?? null,
    bloodType: patient.bloodType ?? null,
    height: patient.height ?? null,
    weight: patient.weight ?? null,
    allergies: patient.allergies ?? null,
    existingConditions: patient.existingConditions ?? null,
    currentMedications: patient.currentMedications ?? null,
    emergencyContactName: patient.emergencyContactName ?? null,
    emergencyContactPhone: patient.emergencyContactPhone ?? null,
    emergencyContactRelation: patient.emergencyContactRelation ?? null,
    phone: patient.phone,
    countryCode: patient.countryCode ?? null,
    updatedAt: new Date(patient.updatedAt),
  };
}

function CriticalBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
      <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-red-500">{label}</dt>
      <dd className="mt-2 text-sm font-bold leading-snug text-red-900">{value}</dd>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/10 p-4">
      <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</dt>
      <dd className="mt-2 text-sm font-bold leading-snug text-white">{value}</dd>
    </div>
  );
}

export default async function MedicalIdPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const patient = await loadEmergencyPatient(token);

  if (!patient) notFound();

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const phone = `${patient.countryCode ?? ""} ${patient.phone}`.trim();

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">

        {/* Emergency header */}
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 to-red-500 p-6 text-white shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.3 4.3 2.3 18a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-13.7a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">HealthKo · Emergency Medical ID</p>
              <h1 className="mt-1 text-2xl font-black leading-tight">{fullName}</h1>
            </div>
          </div>
          <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-semibold text-white/80">
            🔒 Cryptographically signed record · Last updated: {formatDate(patient.updatedAt)}
          </p>
        </header>

        {/* Identity quick-facts */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Patient Identity</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <InfoBadge label="Date of Birth" value={patient.dob} />
            <InfoBadge label="Gender" value={patient.gender || "Not specified"} />
            <InfoBadge label="Blood Type" value={patient.bloodType || "Not recorded"} />
            <InfoBadge label="Height" value={patient.height || "Not recorded"} />
            <InfoBadge label="Weight" value={patient.weight || "Not recorded"} />
            <InfoBadge label="Phone" value={phone || "Not recorded"} />
          </dl>
        </section>

        {/* Critical medical alerts */}
        <section className="rounded-3xl border border-red-500/25 bg-red-500/8 p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">⚠ Critical Medical Alerts</p>
          <dl className="mt-4 grid gap-3">
            <CriticalBadge label="Allergies" value={patient.allergies || "None recorded"} />
            <CriticalBadge label="Existing Conditions" value={patient.existingConditions || "None recorded"} />
            <CriticalBadge label="Current Medications" value={patient.currentMedications || "None recorded"} />
          </dl>
        </section>

        {/* Emergency contact */}
        <section className="rounded-3xl border border-amber-500/25 bg-amber-500/8 p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">Emergency Contact</p>
          <div className="mt-4">
            <p className="text-xl font-black text-white">{patient.emergencyContactName || "Not recorded"}</p>
            <p className="mt-1 text-sm font-semibold text-slate-400">{patient.emergencyContactRelation || "Relation not recorded"}</p>
            {patient.emergencyContactPhone ? (
              <a
                href={`tel:${patient.emergencyContactPhone}`}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-amber-400 active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.7-3.1 19.2 19.2 0 0 1-6-6A19.8 19.8 0 0 1 2 4.1 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.2 1.1.6 2.1 1.1 3a2 2 0 0 1-.4 2.1L8.6 10.6a16 16 0 0 0 4.8 4.8l1.8-1.1a2 2 0 0 1 2.1-.4c.9.5 1.9.9 3 1.1A2 2 0 0 1 22 16.9Z" />
                </svg>
                Call {patient.emergencyContactPhone}
              </a>
            ) : (
              <p className="mt-3 text-sm font-semibold text-slate-500">Phone not recorded</p>
            )}
          </div>
        </section>

        <footer className="pb-4 text-center">
          <p className="text-[10px] font-semibold text-slate-600">
            Powered by{" "}
            <Link href="/" className="font-black text-brand-teal hover:underline">
              HealthKo Telehealth
            </Link>
            {" "}· Publicly accessible via signed QR · No login required
          </p>
        </footer>

      </div>
    </main>
  );
}
