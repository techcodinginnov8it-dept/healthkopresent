"use client";

import { useEffect, useState } from "react";
import type { DoctorAppointment } from "@/lib/dashboard/types";
import { formatDateTime } from "@/lib/dashboard/format";

// ─────────────────────────────────────────────────────────────────────────────
// Theme helper
// ─────────────────────────────────────────────────────────────────────────────
function mkTheme(dark: boolean) {
  return {
    overlay: dark ? "bg-black/70 backdrop-blur-sm" : "bg-black/40 backdrop-blur-sm",
    modal: dark ? "bg-slate-950 border border-slate-800" : "bg-white border border-slate-200 shadow-2xl",
    headerGrad: dark
      ? "bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 border-b border-slate-800"
      : "bg-gradient-to-br from-slate-50 via-white to-teal-50 border-b border-slate-200",
    headerTitle: dark ? "text-white" : "text-slate-900",
    headerSub: dark ? "text-slate-400" : "text-slate-500",
    tabsBar: dark ? "bg-slate-950 border-b border-slate-800" : "bg-white border-b border-slate-200",
    tabActive: dark ? "border-brand-teal text-brand-teal" : "border-brand-teal text-brand-teal",
    tabInactive: dark ? "border-transparent text-slate-500 hover:text-slate-300" : "border-transparent text-slate-400 hover:text-slate-700",
    tabBadgeActive: dark ? "bg-brand-teal/20 text-brand-teal" : "bg-teal-100 text-teal-700",
    tabBadgeInactive: dark ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400",
    body: dark ? "" : "bg-slate-50",
    sectionLabel: dark ? "text-slate-500" : "text-slate-400",
    card: dark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white",
    rowLabel: dark ? "text-slate-500" : "text-slate-400",
    rowValue: dark ? "text-white" : "text-slate-900",
    apptStrip: dark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-white",
    apptReason: dark ? "text-slate-400" : "text-slate-500",
    apptReasonValue: dark ? "text-slate-200" : "text-slate-700",
    pastCard: dark ? "border-slate-800 bg-slate-900/70" : "border-slate-200 bg-white shadow-xs",
    pastCardText: dark ? "text-white" : "text-slate-900",
    pastCardSub: dark ? "text-slate-400" : "text-slate-500",
    pastDivider: dark ? "border-slate-800" : "border-slate-100",
    pastDetail: dark ? "text-slate-300" : "text-slate-700",
    pastPrescription: dark ? "text-emerald-200" : "text-emerald-800",
    pastPrescriptionLabel: dark ? "text-emerald-500" : "text-emerald-600",
    pastExpBtn: dark ? "border-slate-700 bg-slate-800 text-slate-400 hover:text-white" : "border-slate-200 bg-slate-100 text-slate-400 hover:text-slate-700",
    timelineLine: dark ? "bg-slate-800" : "bg-slate-200",
    timelineDot: dark ? "border-slate-700 bg-slate-950 ring-slate-950" : "border-slate-300 bg-white ring-white",
    statCard: dark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white shadow-xs",
    statValue: dark ? "text-white" : "text-slate-900",
    statLabel: dark ? "text-slate-500" : "text-slate-400",
    emptyBorder: dark ? "border-slate-800" : "border-slate-200",
    emptyIcon: dark ? "text-slate-700" : "text-slate-300",
    emptyTitle: dark ? "text-slate-500" : "text-slate-500",
    emptyBody: dark ? "text-slate-600" : "text-slate-400",
    closeBtn: dark ? "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900",
    medTag: dark ? "border-slate-700/60 bg-slate-800/80 text-slate-200" : "border-slate-200 bg-slate-100 text-slate-700",
    pillGhost: dark ? "border-white/12 bg-white/8 text-slate-200" : "border-slate-300 bg-slate-100 text-slate-600",
  };
}

function calcAge(dob?: string | null) {
  if (!dob) return "—";
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < today.getDate())) age--;
  return `${age} yrs`;
}

function Avatar({ image, name, size = 68 }: { image?: string | null; name: string; size?: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  if (image) {
    return <img src={image} alt={name} width={size} height={size} className="rounded-full object-cover ring-4 ring-brand-teal/30 shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div className="grid place-items-center rounded-full bg-gradient-to-br from-brand-teal to-emerald-600 text-white font-black ring-4 ring-brand-teal/20 shrink-0" style={{ width: size, height: size, fontSize: size * 0.32 }}>
      {initials}
    </div>
  );
}

function StatusBadge({ status, dark }: { status: string; dark: boolean }) {
  const map: Record<string, { dark: string; light: string }> = {
    CONFIRMED: { dark: "bg-sky-500/15 border-sky-500/40 text-sky-300", light: "bg-sky-100 border-sky-300 text-sky-700" },
    COMPLETED: { dark: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300", light: "bg-emerald-100 border-emerald-300 text-emerald-700" },
    CANCELLED: { dark: "bg-rose-500/15 border-rose-500/40 text-rose-300", light: "bg-rose-100 border-rose-300 text-rose-700" },
    PENDING:   { dark: "bg-amber-500/15 border-amber-500/40 text-amber-300", light: "bg-amber-100 border-amber-300 text-amber-700" },
  };
  const labels: Record<string, string> = { CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled", PENDING: "Pending" };
  const variant = map[status] ?? { dark: "bg-slate-500/15 border-slate-500/40 text-slate-300", light: "bg-slate-100 border-slate-300 text-slate-600" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${dark ? variant.dark : variant.light}`}>
      {labels[status] ?? status}
    </span>
  );
}

type Tab = "overview" | "history" | "emergency";

function PastConsultCard({ appt, dark, t }: { appt: DoctorAppointment; dark: boolean; t: ReturnType<typeof mkTheme> }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = appt.notes || appt.prescription || appt.bloodPressure || appt.heartRate || appt.bodyTemperature;

  return (
    <div className={`rounded-xl border p-3.5 space-y-2 transition-colors ${t.pastCard}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-black ${t.pastCardText}`}>{formatDateTime(appt.scheduledAt)}</p>
          {appt.reason && <p className={`mt-0.5 text-[11px] font-semibold line-clamp-1 ${t.pastCardSub}`}>{appt.reason}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={appt.status} dark={dark} />
          {hasDetail && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className={`grid h-6 w-6 place-items-center rounded-full border transition ${t.pastExpBtn}`}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <svg viewBox="0 0 24 24" className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {(appt.bloodPressure || appt.heartRate || appt.bodyTemperature) && (
        <div className="flex flex-wrap gap-1.5">
          {appt.bloodPressure && (
            <span className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black ${dark ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
              ❤ BP {appt.bloodPressure}
            </span>
          )}
          {appt.heartRate && (
            <span className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black ${dark ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              ♥ {appt.heartRate} bpm
            </span>
          )}
          {appt.bodyTemperature && (
            <span className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black ${dark ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
              🌡 {appt.bodyTemperature}
            </span>
          )}
        </div>
      )}

      {expanded && hasDetail && (
        <div className={`mt-1 space-y-2.5 border-t pt-2.5 ${t.pastDivider}`}>
          {appt.notes && (
            <div>
              <p className={`text-[9px] font-black uppercase tracking-[0.18em] mb-1 ${t.sectionLabel}`}>Doctor Notes</p>
              <p className={`text-xs font-semibold leading-relaxed whitespace-pre-line ${t.pastDetail}`}>{appt.notes}</p>
            </div>
          )}
          {appt.prescription && (
            <div>
              <p className={`text-[9px] font-black uppercase tracking-[0.18em] mb-1 ${t.pastPrescriptionLabel}`}>Prescription Issued</p>
              <p className={`text-xs font-semibold leading-relaxed whitespace-pre-line ${t.pastPrescription}`}>{appt.prescription}</p>
            </div>
          )}
          {appt.duration && (
            <p className={`text-[10px] font-bold ${t.sectionLabel}`}>Duration: {appt.duration} min</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PatientDataModal — view-only, no confirm/reject actions
// ─────────────────────────────────────────────────────────────────────────────
export function PatientDataModal({
  appointment,
  pastAppointments = [],
  onClose,
  tone = "dark",
}: {
  appointment: DoctorAppointment;
  pastAppointments?: DoctorAppointment[];
  onClose: () => void;
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  const t = mkTheme(dark);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { patient } = appointment;
  const fullName = `${patient.firstName} ${patient.lastName}`;
  const fullAddress = [patient.address, patient.city, patient.state, patient.zipCode, patient.country].filter(Boolean).join(", ");

  const history = [...pastAppointments]
    .filter((a) => a.id !== appointment.id)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  const completedHistory = history.filter((a) => a.status === "COMPLETED");
  const hasEmergency = !!(patient.emergencyContactName || patient.emergencyContactPhone);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 260);
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Medical Profile" },
    { id: "history", label: "Consultations", count: history.length },
    ...(hasEmergency ? [{ id: "emergency" as Tab, label: "Emergency" }] : []),
  ];

  function Card({ children }: { children: React.ReactNode }) {
    return <div className={`grid grid-cols-2 gap-3 rounded-xl border p-3 ${t.card}`}>{children}</div>;
  }
  function Row({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
    return (
      <div className={`flex flex-col gap-0.5 min-w-0 ${full ? "col-span-2" : ""}`}>
        <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${t.rowLabel}`}>{label}</span>
        <span className={`text-xs font-bold truncate ${t.rowValue}`}>{value || "—"}</span>
      </div>
    );
  }
  function SectionLabel({ children, accent }: { children: React.ReactNode; accent?: string }) {
    return <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-2 ${accent ?? t.sectionLabel}`}>{children}</p>;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? t.overlay : "bg-black/0"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Patient data — ${fullName}`}
    >
      <div
        className={`relative flex flex-col w-full max-w-2xl rounded-2xl overflow-hidden transition-all duration-300 ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
        } ${t.modal}`}
        style={{ maxHeight: "92vh" }}
      >
        {/* ── HEADER ── */}
        <div className={`relative shrink-0 px-6 pt-5 pb-5 ${t.headerGrad}`}>
          <button type="button" onClick={handleClose} className={`absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full transition ${t.closeBtn}`} aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>

          <div className="flex items-start gap-4">
            <Avatar image={patient.image} name={fullName} size={68} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <StatusBadge status={appointment.status} dark={dark} />
                {completedHistory.length > 0 && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${dark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-400 bg-emerald-50 text-emerald-700"}`}>
                    ✓ Returning · {completedHistory.length} visit{completedHistory.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <h2 className={`text-xl font-black leading-tight ${t.headerTitle}`}>{fullName}</h2>
              <p className={`text-xs font-semibold mt-0.5 ${t.headerSub}`}>{patient.email}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${t.pillGhost}`}>{calcAge(patient.dob)}</span>
                {patient.gender && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black capitalize ${t.pillGhost}`}>{patient.gender}</span>}
                {patient.bloodType && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${dark ? "border-rose-500/40 bg-rose-500/12 text-rose-300" : "border-rose-300 bg-rose-50 text-rose-700"}`}>
                    {patient.bloodType}
                  </span>
                )}
                {[patient.height, patient.weight].filter(Boolean).length > 0 && (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${t.pillGhost}`}>
                    {[patient.height, patient.weight].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Appointment strip */}
          <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${t.apptStrip}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Appointment</p>
              <p className={`text-sm font-black mt-0.5 ${t.headerTitle}`}>{formatDateTime(appointment.scheduledAt)}</p>
              {appointment.reason && (
                <p className={`text-xs font-semibold mt-0.5 line-clamp-1 ${t.apptReason}`}>
                  Chief Complaint: <span className={t.apptReasonValue}>{appointment.reason}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className={`flex shrink-0 gap-0.5 px-4 pt-2 ${t.tabsBar}`}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 pb-2 pt-1.5 text-xs font-black uppercase tracking-wider transition ${
                activeTab === tab.id ? t.tabActive : t.tabInactive
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                  activeTab === tab.id ? t.tabBadgeActive : t.tabBadgeInactive
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── BODY ── */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 min-h-0 ${t.body}`}>

          {/* ── MEDICAL PROFILE TAB ── */}
          {activeTab === "overview" && (
            <>
              <section>
                <SectionLabel>Contact &amp; Identity</SectionLabel>
                <Card>
                  <Row label="Phone" value={[patient.countryCode, patient.phone].filter(Boolean).join(" ")} />
                  <Row label="Date of Birth" value={patient.dob} />
                  <Row label="Gender" value={patient.gender} />
                  <Row label="Email Verified" value={patient.emailVerified ? "✓ Verified" : "Not verified"} />
                  {fullAddress && <Row label="Address" value={fullAddress} full />}
                </Card>
              </section>

              <section>
                <SectionLabel>Biometrics</SectionLabel>
                <Card>
                  <Row label="Blood Type" value={patient.bloodType} />
                  <Row label="Height" value={patient.height} />
                  <Row label="Weight" value={patient.weight} />
                  <Row label="BMI" value={(() => {
                    const h = parseFloat(patient.height ?? "");
                    const w = parseFloat(patient.weight ?? "");
                    if (!h || !w) return null;
                    const hm = h > 10 ? h / 100 : h;
                    return `${(w / (hm * hm)).toFixed(1)} kg/m²`;
                  })()} />
                </Card>
              </section>

              {patient.allergies && (
                <section>
                  <SectionLabel accent={dark ? "text-rose-400" : "text-rose-600"}>⚠ Allergies</SectionLabel>
                  <div className={`rounded-xl border p-3 ${dark ? "border-rose-500/30 bg-rose-500/8" : "border-rose-200 bg-rose-50"}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {patient.allergies.split(/[,;/\n]+/).map((a) => a.trim()).filter(Boolean).map((a) => (
                        <span key={a} className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${dark ? "border-rose-500/40 bg-rose-500/15 text-rose-200" : "border-rose-300 bg-white text-rose-700"}`}>{a}</span>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {patient.existingConditions && (
                <section>
                  <SectionLabel accent={dark ? "text-amber-400" : "text-amber-600"}>Existing Conditions</SectionLabel>
                  <div className={`rounded-xl border p-3 ${dark ? "border-amber-500/30 bg-amber-500/8" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {patient.existingConditions.split(/[,;/\n]+/).map((c) => c.trim()).filter(Boolean).map((c) => (
                        <span key={c} className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${dark ? "border-amber-500/40 bg-amber-500/15 text-amber-200" : "border-amber-300 bg-white text-amber-700"}`}>{c}</span>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {patient.currentMedications && (
                <section>
                  <SectionLabel accent={dark ? "text-sky-400" : "text-sky-600"}>Current Medications</SectionLabel>
                  <div className={`rounded-xl border p-3 ${dark ? "border-sky-500/30 bg-sky-500/8" : "border-sky-200 bg-sky-50"}`}>
                    <div className="flex flex-wrap gap-1.5">
                      {patient.currentMedications.split(/[,;/\n]+/).map((m) => m.trim()).filter(Boolean).map((m) => (
                        <span key={m} className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${t.medTag}`}>{m}</span>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {!patient.allergies && !patient.existingConditions && !patient.currentMedications && (
                <div className={`rounded-xl border border-dashed p-5 text-center ${t.emptyBorder}`}>
                  <p className={`text-xs font-semibold ${t.emptyTitle}`}>No prior medical history on file.</p>
                </div>
              )}
            </>
          )}

          {/* ── CONSULTATIONS TAB ── */}
          {activeTab === "history" && (
            <>
              {history.length === 0 ? (
                <div className={`rounded-xl border border-dashed p-8 text-center ${t.emptyBorder}`}>
                  <svg viewBox="0 0 24 24" className={`mx-auto h-8 w-8 mb-2 ${t.emptyIcon}`} fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 12h6M9 16h6M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l5 5v11a2 2 0 0 1-2 2z"/>
                  </svg>
                  <p className={`text-sm font-black ${t.emptyTitle}`}>First Visit</p>
                  <p className={`text-xs font-semibold mt-1 ${t.emptyBody}`}>No previous consultations on record.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Total Visits", value: history.length },
                      { label: "Completed", value: completedHistory.length },
                      { label: "Cancelled", value: history.filter((a) => a.status === "CANCELLED").length },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-xl border p-3 text-center ${t.statCard}`}>
                        <p className={`text-xl font-black ${t.statValue}`}>{s.value}</p>
                        <p className={`text-[9px] font-black uppercase tracking-wider mt-0.5 ${t.statLabel}`}>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2.5 relative">
                    <div className={`absolute left-3.5 top-0 bottom-0 w-px ${t.timelineLine}`} aria-hidden="true" />
                    {history.map((appt) => (
                      <div key={appt.id} className="relative pl-8">
                        <div className={`absolute left-2 top-4 h-3 w-3 rounded-full border-2 ring-2 ${t.timelineDot}`} />
                        <PastConsultCard appt={appt} dark={dark} t={t} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── EMERGENCY TAB ── */}
          {activeTab === "emergency" && (
            <section>
              <SectionLabel>Emergency Contact</SectionLabel>
              <Card>
                <Row label="Name" value={patient.emergencyContactName} />
                <Row label="Relation" value={patient.emergencyContactRelation} />
                <Row label="Phone" value={patient.emergencyContactPhone} full />
              </Card>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
