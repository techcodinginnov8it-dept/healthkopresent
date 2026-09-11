"use client";

import { useEffect, useState, useTransition } from "react";
import { issueMedicalCertificate, getDoctorMedicalCertificates } from "@/app/actions/doctor";
import { downloadMedicalCertificatePdf } from "@/lib/medical-certificate-pdf";

type Tone = "light" | "dark";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  licenseNumber?: string | null;
  npi?: string | null;
  bookings: {
    patient: Patient;
    status: string;
  }[];
}

type CertPurpose = "sick_leave" | "fitness_to_work" | "school" | "other";

interface IssuedCert {
  id: string;
  certNumber: string;
  purpose: string;
  diagnosis: string | null;
  remarks: string | null;
  restDaysFrom: Date | string | null;
  restDaysTo: Date | string | null;
  issuedAt: Date | string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dob?: string | null;
    gender?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };
  doctor: {
    name: string;
    specialty: string;
    licenseNumber?: string | null;
    npi?: string | null;
  };
}

const PURPOSE_OPTIONS: { value: CertPurpose; label: string }[] = [
  { value: "sick_leave", label: "Sick Leave / Medical Rest" },
  { value: "fitness_to_work", label: "Fitness to Return to Work" },
  { value: "school", label: "School / Academic Purpose" },
  { value: "other", label: "General Medical Certificate" },
];

function formatDate(d?: Date | string | null) {
  if (!d) return "—";
  const obj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(obj.getTime())) return String(d);
  return obj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getAge(dob?: string | null): string {
  if (!dob) return "Adult";
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
  return age >= 0 ? `${age} years` : "Adult";
}

const PURPOSE_LABELS: Record<string, string> = {
  sick_leave: "Sick Leave / Medical Rest",
  fitness_to_work: "Fitness to Return to Work",
  school: "School / Academic Purpose",
  other: "General Medical Certificate",
};

export function MedicalCertificateHub({ doctor, tone }: { doctor: Doctor; tone: Tone }) {
  const isDark = tone === "dark";

  // ── Issued certificates ─────────────────────────────────────────────────
  const [certificates, setCertificates] = useState<IssuedCert[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(true);
  const [tab, setTab] = useState<"issue" | "history">("issue");

  useEffect(() => {
    getDoctorMedicalCertificates().then((res) => {
      if (res.success && res.certificates) {
        setCertificates(res.certificates as IssuedCert[]);
      }
      setLoadingCerts(false);
    });
  }, []);

  // ── Patient list from bookings ───────────────────────────────────────────
  const uniquePatients = (() => {
    const seen = new Set<string>();
    const list: Patient[] = [];
    for (const b of doctor.bookings) {
      if (!seen.has(b.patient.id)) {
        seen.add(b.patient.id);
        list.push(b.patient as Patient);
      }
    }
    return list;
  })();

  // ── Form state ───────────────────────────────────────────────────────────
  const [patientId, setPatientId] = useState(uniquePatients[0]?.id ?? "");
  const [purpose, setPurpose] = useState<CertPurpose>("sick_leave");
  const [diagnosis, setDiagnosis] = useState("");
  const [remarks, setRemarks] = useState("");
  const [restFrom, setRestFrom] = useState("");
  const [restTo, setRestTo] = useState("");
  const [toastMsg, setToastMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(kind: "success" | "error", text: string) {
    setToastMsg({ kind, text });
    setTimeout(() => setToastMsg(null), 4000);
  }

  const selectedPatient = uniquePatients.find((p) => p.id === patientId) ?? null;

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) return showToast("error", "Select a patient.");
    if (!diagnosis.trim()) return showToast("error", "Diagnosis / condition is required.");

    startTransition(async () => {
      const res = await issueMedicalCertificate({
        patientId,
        purpose,
        diagnosis: diagnosis.trim(),
        remarks: remarks.trim() || undefined,
        restDaysFrom: purpose === "sick_leave" && restFrom ? restFrom : undefined,
        restDaysTo: purpose === "sick_leave" && restTo ? restTo : undefined,
      });

      if (!res.success || !res.certificate) {
        showToast("error", res.error ?? "Failed to issue certificate.");
        return;
      }

      const cert = res.certificate as IssuedCert;
      setCertificates((prev) => [cert, ...prev]);

      // Auto-download PDF
      const pat = cert.patient;
      downloadMedicalCertificatePdf({
        certNumber: cert.certNumber,
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialty,
        doctorLicense: doctor.licenseNumber,
        doctorNpi: doctor.npi,
        patientName: `${pat.firstName} ${pat.lastName}`,
        patientAge: getAge(pat.dob),
        patientGender: pat.gender,
        patientAddress: pat.address ? `${pat.address}${pat.city ? `, ${pat.city}` : ""}` : undefined,
        purpose: cert.purpose as CertPurpose,
        diagnosis: cert.diagnosis,
        remarks: cert.remarks,
        restDaysFrom: cert.restDaysFrom ?? undefined,
        restDaysTo: cert.restDaysTo ?? undefined,
        issuedAt: cert.issuedAt,
      });

      showToast("success", `Certificate ${cert.certNumber} issued and PDF downloaded.`);
      setDiagnosis("");
      setRemarks("");
      setRestFrom("");
      setRestTo("");
      setTab("history");
    });
  }

  // ── Styles ───────────────────────────────────────────────────────────────
  const card = isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white";
  const inputCls = `w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-brand-teal/20 focus:border-brand-teal ${
    isDark
      ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
      : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
  }`;
  const labelCls = "text-[10px] font-black uppercase tracking-wider " + (isDark ? "text-slate-400" : "text-slate-500");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Medical Certificate</p>
          <h2 className={`mt-0.5 text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
            Certificate Issuance
          </h2>
          <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Issue official medical certificates linked to your consultation records.
          </p>
        </div>
        <div className={`flex gap-1 rounded-xl border p-1 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
          {(["issue", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                tab === t
                  ? "bg-brand-teal text-white shadow-sm"
                  : isDark
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t === "issue" ? "Issue Certificate" : `History (${certificates.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-black ${
            toastMsg.kind === "success"
              ? isDark
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-emerald-300 bg-emerald-50 text-emerald-700"
              : isDark
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-rose-300 bg-rose-50 text-rose-700"
          }`}
        >
          {toastMsg.text}
        </div>
      )}

      {/* ── Issue Form ── */}
      {tab === "issue" && (
        <form onSubmit={handleIssue} className={`rounded-2xl border p-6 space-y-5 ${card}`}>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Patient */}
            <label className="space-y-1.5 md:col-span-2">
              <span className={labelCls}>Patient</span>
              {uniquePatients.length === 0 ? (
                <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  No patients found. Complete at least one consultation first.
                </p>
              ) : (
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">Select a patient…</option>
                  {uniquePatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              )}
            </label>

            {/* Selected patient info */}
            {selectedPatient && (
              <div className={`md:col-span-2 rounded-xl border px-4 py-3 flex items-center gap-3 ${isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black ${isDark ? "bg-brand-teal/20 text-brand-teal" : "bg-brand-teal/15 text-brand-teal"}`}>
                  {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                </div>
                <div>
                  <p className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {getAge(selectedPatient.dob)} · {selectedPatient.gender || "Unspecified"}
                    {selectedPatient.city ? ` · ${selectedPatient.city}` : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Purpose */}
            <label className="space-y-1.5">
              <span className={labelCls}>Certificate Purpose</span>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value as CertPurpose)} className={inputCls}>
                {PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            {/* Diagnosis */}
            <label className="space-y-1.5">
              <span className={labelCls}>Diagnosis / Condition <span className="text-rose-500">*</span></span>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute upper respiratory tract infection"
                className={inputCls}
                required
              />
            </label>

            {/* Rest period — sick leave only */}
            {purpose === "sick_leave" && (
              <>
                <label className="space-y-1.5">
                  <span className={labelCls}>Rest Period — From</span>
                  <input type="date" value={restFrom} onChange={(e) => setRestFrom(e.target.value)} className={inputCls} />
                </label>
                <label className="space-y-1.5">
                  <span className={labelCls}>Rest Period — To</span>
                  <input type="date" value={restTo} onChange={(e) => setRestTo(e.target.value)} className={inputCls} />
                </label>
              </>
            )}

            {/* Remarks */}
            <label className="space-y-1.5 md:col-span-2">
              <span className={labelCls}>Additional Remarks (optional)</span>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Follow-up instructions, special advice, limitations, etc."
                className={inputCls}
              />
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending || uniquePatients.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-6 py-3 text-xs font-black text-white shadow-md transition hover:bg-brand-teal/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" className="opacity-25" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                  Issuing…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  Issue Certificate &amp; Download PDF
                </>
              )}
            </button>
            <p className={`text-[10px] font-bold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Certificate will be generated &amp; downloaded automatically.
            </p>
          </div>
        </form>
      )}

      {/* ── History ── */}
      {tab === "history" && (
        <div className="space-y-3">
          {loadingCerts ? (
            <div className={`rounded-2xl border p-12 text-center text-xs font-semibold ${card} ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Loading certificates…
            </div>
          ) : certificates.length === 0 ? (
            <div className={`rounded-2xl border p-12 text-center ${card}`}>
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? "bg-brand-teal/10 text-brand-teal/60" : "bg-teal-50 text-teal-400"}`}>
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                </svg>
              </div>
              <p className={`mt-4 text-sm font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}>No certificates issued yet</p>
              <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Use the Issue Certificate tab to create one.
              </p>
            </div>
          ) : (
            certificates.map((cert) => (
              <div key={cert.id} className={`rounded-2xl border p-4 ${card}`}>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? "bg-brand-teal/15 text-brand-teal" : "bg-teal-50 text-teal-600"}`}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                        {cert.patient.firstName} {cert.patient.lastName}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${isDark ? "bg-brand-teal/15 text-brand-teal" : "bg-teal-100 text-teal-700"}`}>
                        {PURPOSE_LABELS[cert.purpose] ?? cert.purpose}
                      </span>
                    </div>
                    <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {cert.certNumber} · Issued {formatDate(cert.issuedAt)}
                    </p>
                    {cert.diagnosis && (
                      <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                        <span className="font-black">Dx:</span> {cert.diagnosis}
                      </p>
                    )}
                    {cert.restDaysFrom && cert.restDaysTo && (
                      <p className={`mt-0.5 text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                        <span className="font-black">Rest:</span> {formatDate(cert.restDaysFrom)} – {formatDate(cert.restDaysTo)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    title="Re-download PDF"
                    onClick={() => {
                      const pat = cert.patient;
                      downloadMedicalCertificatePdf({
                        certNumber: cert.certNumber,
                        doctorName: cert.doctor.name,
                        doctorSpecialty: cert.doctor.specialty,
                        doctorLicense: cert.doctor.licenseNumber,
                        doctorNpi: cert.doctor.npi,
                        patientName: `${pat.firstName} ${pat.lastName}`,
                        patientAge: getAge(pat.dob),
                        patientGender: pat.gender,
                        patientAddress: pat.address ? `${pat.address}${pat.city ? `, ${pat.city}` : ""}` : undefined,
                        purpose: cert.purpose as CertPurpose,
                        diagnosis: cert.diagnosis,
                        remarks: cert.remarks,
                        restDaysFrom: cert.restDaysFrom ?? undefined,
                        restDaysTo: cert.restDaysTo ?? undefined,
                        issuedAt: cert.issuedAt,
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition ${
                      isDark
                        ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    PDF
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
