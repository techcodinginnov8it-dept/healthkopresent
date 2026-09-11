"use client";

import { useState, useMemo } from "react";
import type { DashboardDoctor, DoctorAppointment } from "@/lib/dashboard/types";
import { formatDateTime } from "@/lib/dashboard/format";
import { parseNotesAndTranscript, downloadConsultationTranscriptPdf } from "@/lib/consultation-transcript-pdf";
import { downloadPrescriptionPdf } from "@/lib/prescription-pdf";

type DoctorNotesHubProps = {
  doctor: DashboardDoctor & {
    consultFee?: number | null;
    licenseNumber?: string | null;
    npi: string;
  };
  completedConsultations: DoctorAppointment[];
  allConsultations: DoctorAppointment[];
  tone?: "light" | "dark";
};

type NoteFilter = "all" | "transcript" | "rx" | "vitals";

export function DoctorNotesHub({
  doctor,
  completedConsultations,
  allConsultations,
  tone = "light",
}: DoctorNotesHubProps) {
  const isDark = tone === "dark";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NoteFilter>("all");
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Combine consultations that have either COMPLETED status or non-empty notes
  const notesConsultations = useMemo(() => {
    const map = new Map<string, DoctorAppointment>();
    completedConsultations.forEach((c) => map.set(c.id, c));
    allConsultations.forEach((c) => {
      if (c.notes && c.notes.trim().length > 0) {
        map.set(c.id, c);
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
  }, [completedConsultations, allConsultations]);

  // Filter & search
  const filteredRecords = useMemo(() => {
    return notesConsultations.filter((booking) => {
      const parsed = parseNotesAndTranscript(booking.notes || "");
      const hasTranscript = Boolean(parsed.transcriptTurns && parsed.transcriptTurns.length > 0);
      const hasRx = Boolean(booking.prescription && booking.prescription.trim().length > 0);
      const hasVitals = Boolean(
        (booking.bloodPressure && booking.bloodPressure !== "N/A") ||
        (booking.heartRate && booking.heartRate !== "N/A") ||
        (booking.bodyTemperature && booking.bodyTemperature !== "N/A")
      );

      if (filter === "transcript" && !hasTranscript) return false;
      if (filter === "rx" && !hasRx) return false;
      if (filter === "vitals" && !hasVitals) return false;

      if (!search.trim()) return true;

      const q = search.toLowerCase();
      const patName = `${booking.patient.firstName} ${booking.patient.lastName}`.toLowerCase();
      const reason = (booking.reason || "").toLowerCase();
      const notes = (parsed.clinicalNotes || booking.notes || "").toLowerCase();
      const rx = (booking.prescription || "").toLowerCase();

      return patName.includes(q) || reason.includes(q) || notes.includes(q) || rx.includes(q);
    });
  }, [notesConsultations, filter, search]);

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyNotes = (id: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDownloadTranscript = (appointment: DoctorAppointment) => {
    const pat = appointment.patient;
    const patAge = pat?.dob
      ? Math.floor((Date.now() - new Date(pat.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
      : "Adult";
    const docName = `Dr. ${doctor.name.replace(/^Dr\.?\s+/i, "")}`;
    const docSpecialty = doctor.specialty || "General Medicine";
    const docLicense = doctor.licenseNumber || "MD-ACTIVE";
    const docNpi = doctor.npi || "NPI-VERIFIED";
    const clinicName = `CLINIC OF ${docName.toUpperCase()}, MD`;
    const patientName = `${pat.firstName} ${pat.lastName}`;

    let cleanNotes = appointment.notes || "";
    let customTranscript: any = undefined;
    if (appointment.notes) {
      const parsed = parseNotesAndTranscript(appointment.notes);
      cleanNotes = parsed.clinicalNotes;
      if (parsed.transcriptTurns && parsed.transcriptTurns.length > 0) {
        customTranscript = parsed.transcriptTurns;
      }
    }

    if (!customTranscript && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`healthko:transcript:${appointment.id}`);
        if (saved) customTranscript = JSON.parse(saved);
      } catch {
        // Ignore fallback
      }
    }

    downloadConsultationTranscriptPdf({
      appointmentId: appointment.id,
      doctorName: docName,
      doctorSpecialty: docSpecialty,
      doctorLicense: docLicense,
      doctorNpi: docNpi,
      clinicName,
      patientName,
      patientAge: patAge,
      patientGender: pat.gender,
      date: appointment.scheduledAt,
      durationMinutes: appointment.duration || 30,
      reasonForVisit: appointment.reason || "Telehealth Consultation",
      clinicalAssessment:
        cleanNotes ||
        appointment.notes ||
        "Clinical consultation and assessment completed via synchronous telehealth.",
      clinicalPlan: appointment.prescription
        ? `Electronic prescription issued:\n${appointment.prescription}`
        : "Follow-up consultation advised as clinically indicated.",
      transcript: customTranscript,
    });
  };

  const handleDownloadRx = (appointment: DoctorAppointment) => {
    if (!appointment.prescription) return;
    const pat = appointment.patient;
    const patAge = pat?.dob
      ? Math.floor((Date.now() - new Date(pat.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
      : "Adult";
    const docName = `Dr. ${doctor.name.replace(/^Dr\.?\s+/i, "")}`;

    downloadPrescriptionPdf({
      appointmentId: appointment.id,
      doctorName: docName,
      doctorSpecialty: doctor.specialty || "General Medicine",
      doctorLicense: doctor.licenseNumber || "MD-ACTIVE",
      doctorNpi: doctor.npi || "NPI-VERIFIED",
      clinicName: `CLINIC OF ${docName.toUpperCase()}, MD`,
      patientName: `${pat.firstName} ${pat.lastName}`,
      patientAge: patAge,
      patientGender: pat.gender,
      patientAddress: pat.address ? `${pat.address}, ${pat.city || ""}` : undefined,
      date: appointment.scheduledAt,
      prescription: appointment.prescription,
    });
  };

  const transcriptCount = useMemo(() => {
    return notesConsultations.filter((b) => {
      const p = parseNotesAndTranscript(b.notes || "");
      return p.transcriptTurns && p.transcriptTurns.length > 0;
    }).length;
  }, [notesConsultations]);

  const rxCount = useMemo(() => {
    return notesConsultations.filter((b) => b.prescription && b.prescription.trim().length > 0).length;
  }, [notesConsultations]);

  const vitalsCount = useMemo(() => {
    return notesConsultations.filter(
      (b) =>
        (b.bloodPressure && b.bloodPressure !== "N/A") ||
        (b.heartRate && b.heartRate !== "N/A") ||
        (b.bodyTemperature && b.bodyTemperature !== "N/A")
    ).length;
  }, [notesConsultations]);

  return (
    <section className="space-y-6">
      {/* ── Header Banner ────────────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl border p-6 transition-colors ${
          isDark
            ? "border-slate-850 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-900 shadow-xs"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">
                Clinical Documentation & EHR
              </p>
            </div>
            <h2 className={`mt-1 text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
              Consultation Notes Archive
            </h2>
            <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Official medical records, diagnostic evaluations, consultation dialogue transcripts, and e-prescriptions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl border px-3.5 py-2 text-right ${
                isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-slate-50"
              }`}
            >
              <p className="text-[9px] font-black uppercase tracking-wider text-brand-teal">Total Clinical Records</p>
              <p className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                {notesConsultations.length} Encounters
              </p>
            </div>
          </div>
        </div>

        {/* ── Search & Filter Controls ────────────────────────────────────────── */}
        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div
            className={`flex flex-1 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors ${
              isDark
                ? "border-slate-800 bg-slate-950 focus-within:border-brand-teal"
                : "border-slate-200 bg-slate-50 focus-within:border-brand-teal"
            }`}
          >
            <svg
              className={`h-4 w-4 shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient name, diagnosis, clinical notes, or prescription..."
              className={`w-full bg-transparent text-xs font-medium outline-none ${
                isDark ? "text-white placeholder:text-slate-600" : "text-slate-900 placeholder:text-slate-400"
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[11px] font-bold text-slate-400 hover:text-brand-teal"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {[
              { id: "all" as const, label: "All Records", count: notesConsultations.length },
              { id: "transcript" as const, label: "With Dialogue", count: transcriptCount },
              { id: "rx" as const, label: "With Rx", count: rxCount },
              { id: "vitals" as const, label: "With Vitals", count: vitalsCount },
            ].map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${
                    active
                      ? "bg-brand-teal text-white shadow-xs"
                      : isDark
                      ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${
                      active
                        ? "bg-white/20 text-white"
                        : isDark
                        ? "bg-slate-900 text-slate-400"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Encounters List ──────────────────────────────────────────────────── */}
      {filteredRecords.length > 0 ? (
        <div className="space-y-4">
          {filteredRecords.map((booking) => {
            const pat = booking.patient;
            const patAge = pat?.dob
              ? Math.floor((Date.now() - new Date(pat.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
              : null;
            const parsed = parseNotesAndTranscript(booking.notes || "");
            const cleanNotes = parsed.clinicalNotes || booking.notes || "Clinical consultation completed.";
            const transcriptTurns = parsed.transcriptTurns || [];
            const isTranscriptOpen = Boolean(expandedTranscripts[booking.id]);
            const hasVitals = Boolean(booking.bloodPressure || booking.heartRate || booking.bodyTemperature);
            const isCopied = copiedId === booking.id;

            return (
              <article
                key={booking.id}
                className={`overflow-hidden rounded-2xl border transition-all ${
                  isDark
                    ? "border-slate-850 bg-slate-900/90 hover:border-slate-800"
                    : "border-slate-200 bg-white shadow-xs hover:border-slate-300"
                }`}
              >
                {/* Top Patient & Encounter Header */}
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b ${
                    isDark ? "border-slate-800/80 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-teal/15 text-sm font-black text-brand-teal border border-brand-teal/20">
                      {pat.firstName?.[0]}
                      {pat.lastName?.[0]}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                          {pat.firstName} {pat.lastName}
                        </h3>
                        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-500">
                          {booking.status}
                        </span>
                        {transcriptTurns.length > 0 && (
                          <span className="rounded-md border border-brand-teal/30 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-teal flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />
                            Audio Dialogue
                          </span>
                        )}
                      </div>
                      <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {patAge ? `${patAge} yrs old` : "Adult"} · {pat.gender ? pat.gender.toUpperCase() : "Unspecified"} · Contact: {pat.email}
                      </p>
                    </div>
                  </div>

                  {/* Encounter Date & Duration */}
                  <div
                    className={`rounded-xl border px-3.5 py-2 text-left sm:text-right shrink-0 ${
                      isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"
                    }`}
                  >
                    <p className="text-[9px] font-black uppercase tracking-wider text-brand-teal">Encounter Timestamp</p>
                    <p className={`mt-0.5 text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                      {formatDateTime(booking.scheduledAt)}
                    </p>
                    <p className={`text-[10px] font-semibold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      Duration: {booking.duration || 30} mins
                    </p>
                  </div>
                </div>

                {/* Vitals Strip (if recorded) */}
                {hasVitals && (
                  <div
                    className={`flex flex-wrap items-center gap-4 px-5 py-2.5 border-b text-xs ${
                      isDark ? "border-slate-800/80 bg-slate-900/60" : "border-slate-100 bg-slate-50/80"
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-teal">
                      Consultation Vitals:
                    </span>
                    {booking.bloodPressure && (
                      <span className={`flex items-center gap-1.5 font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        <span className="text-red-500">❤️</span> BP: <span className="font-black text-brand-teal">{booking.bloodPressure}</span> mmHg
                      </span>
                    )}
                    {booking.heartRate && (
                      <span className={`flex items-center gap-1.5 font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        <span className="text-amber-500">⚡</span> Heart Rate: <span className="font-black text-brand-teal">{booking.heartRate}</span> bpm
                      </span>
                    )}
                    {booking.bodyTemperature && (
                      <span className={`flex items-center gap-1.5 font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                        <span className="text-blue-500">🌡️</span> Temp: <span className="font-black text-brand-teal">{booking.bodyTemperature}</span> °F
                      </span>
                    )}
                  </div>
                )}

                {/* Body Content: Reason & Clinical Assessment */}
                <div className="p-5 space-y-4">
                  {booking.reason && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                        Chief Complaint & Reason for Visit
                      </p>
                      <p className={`text-xs font-semibold leading-relaxed rounded-xl p-3 border ${
                        isDark ? "border-slate-800 bg-slate-950/60 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-800"
                      }`}>
                        {booking.reason}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">
                        Clinical Assessment & Physician Notes
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyNotes(booking.id, cleanNotes)}
                        className={`text-[10px] font-black transition ${
                          isCopied ? "text-emerald-500" : "text-slate-400 hover:text-brand-teal"
                        }`}
                      >
                        {isCopied ? "✓ Copied to Clipboard" : "Copy Notes"}
                      </button>
                    </div>
                    <div
                      className={`whitespace-pre-wrap rounded-xl border p-3.5 text-xs font-medium leading-relaxed ${
                        isDark
                          ? "border-slate-800 bg-slate-950 text-slate-200"
                          : "border-slate-200 bg-white text-slate-800 shadow-2xs"
                      }`}
                    >
                      {cleanNotes}
                    </div>
                  </div>

                  {/* Prescription Strip (if present) */}
                  {booking.prescription && (
                    <div
                      className={`rounded-xl border p-3.5 ${
                        isDark ? "border-emerald-800/40 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-emerald-500 text-sm">💊</span>
                        <p className={`text-[10px] font-black uppercase tracking-wider ${
                          isDark ? "text-emerald-400" : "text-emerald-800"
                        }`}>
                          Prescribed Medication (e-Prescription)
                        </p>
                      </div>
                      <p className={`text-xs font-bold leading-relaxed ${
                        isDark ? "text-emerald-200" : "text-emerald-900"
                      }`}>
                        {booking.prescription}
                      </p>
                    </div>
                  )}

                  {/* Dialogue Transcript Accordion (if dialogue was recorded) */}
                  {transcriptTurns.length > 0 && (
                    <div className={`rounded-xl border overflow-hidden ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                      <button
                        type="button"
                        onClick={() => toggleTranscript(booking.id)}
                        className={`w-full flex items-center justify-between p-3 text-xs font-black transition ${
                          isDark
                            ? "bg-slate-850 hover:bg-slate-800 text-slate-200"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>🎙️</span>
                          Live Encounter Dialogue Transcript ({transcriptTurns.length} spoken exchanges)
                        </span>
                        <span className="text-[10px] font-black text-brand-teal">
                          {isTranscriptOpen ? "Hide Transcript ▲" : "View Spoken Transcript ▼"}
                        </span>
                      </button>

                      {isTranscriptOpen && (
                        <div
                          className={`p-4 space-y-2.5 max-h-72 overflow-y-auto divide-y ${
                            isDark
                              ? "bg-slate-950 divide-slate-850/80"
                              : "bg-white divide-slate-100"
                          }`}
                        >
                          {transcriptTurns.map((turn, idx) => {
                            const isDoctor = turn.role === "doctor" || turn.speaker.toLowerCase().includes("dr");
                            return (
                              <div key={turn.id || idx} className="pt-2.5 first:pt-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                      isDoctor
                                        ? "bg-brand-teal/20 text-brand-teal"
                                        : isDark
                                        ? "bg-slate-800 text-slate-300"
                                        : "bg-slate-200 text-slate-700"
                                    }`}
                                  >
                                    {turn.speaker}
                                  </span>
                                  {turn.timestamp && (
                                    <span className="text-[9px] font-mono text-slate-400">
                                      {turn.timestamp}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs font-medium leading-relaxed pl-1 ${
                                  isDark ? "text-slate-300" : "text-slate-800"
                                }`}>
                                  {turn.text}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div
                  className={`flex flex-wrap items-center justify-end gap-3 px-5 py-3 border-t ${
                    isDark ? "border-slate-850 bg-slate-950/60" : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  {booking.prescription && (
                    <button
                      type="button"
                      onClick={() => handleDownloadRx(booking)}
                      className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black transition ${
                        isDark
                          ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      <span>💊</span>
                      Download Rx (PDF)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDownloadTranscript(booking)}
                    className="flex items-center gap-1.5 rounded-xl bg-brand-teal px-4 py-2 text-xs font-black text-white shadow-xs transition hover:bg-brand-teal/90 active:scale-[0.98]"
                  >
                    <span>📄</span>
                    Download Consultation Transcript (PDF)
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div
          className={`rounded-2xl border p-12 text-center ${
            isDark ? "border-slate-850 bg-slate-900" : "border-slate-200 bg-white shadow-xs"
          }`}
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-teal/10 text-xl text-brand-teal mb-3">
            📋
          </div>
          <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
            {search || filter !== "all" ? "No matching consultation notes" : "No clinical notes yet"}
          </h3>
          <p className={`mt-1 text-xs font-medium max-w-md mx-auto ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {search || filter !== "all"
              ? "Try adjusting your search query or switching the filter tab to find the desired encounter record."
              : "Completed live telehealth consultations will generate permanent clinical notes and dialogue archives here."}
          </p>
          {(search || filter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
              className="mt-4 rounded-xl bg-brand-teal px-4 py-2 text-xs font-black text-white hover:bg-brand-teal/90 transition"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}
