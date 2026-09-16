"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { logoutAdmin } from "@/app/actions/auth";
import {
  toggleDoctorStatus,
  togglePatientStatus,
  toggleDoctorVerification,
  deleteDoctorByAdmin,
  deletePatientByAdmin,
} from "@/app/actions/admin";
import {
  approveDoctorAudit,
  rejectDoctorAudit,
} from "@/app/actions/audit";
import type {
  AdminModuleId,
  AdminDoctorEntity,
  AdminPatientEntity,
  AdminConsultationEntity,
  AdminSystemStats,
} from "@/lib/dashboard/types";
import { formatDate, formatDateTime } from "@/lib/dashboard/format";

const NAV_ITEMS: DashboardNavItem<AdminModuleId>[] = [
  { id: "overview", label: "Command Center" },
  { id: "screening", label: "Doctor Screening" },
  { id: "doctors", label: "Doctors Directory" },
  { id: "patients", label: "Patients Directory" },
  { id: "consultations", label: "Consultations" },
  { id: "analytics", label: "Analytics & Growth" },
  { id: "settings", label: "Admin Settings" },
];

type DoctorAudit = {
  id: string;
  doctorId: string | null;
  npi: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  documentName: string | null;
  approvalType?: string;
  status: string;
  signature: string;
  consent: boolean;
  doctorEmail?: string | null;
  submittedAt: string;
  updatedAt: string;
  doctor: {
    id: string;
    name: string;
    email: string;
    specialty: string;
  } | null;
};

/** Parse JSON-encoded documentName field into typed objects */
function parseDocumentName(raw: string | null): {
  front: { name: string; url: string } | null;
  back: { name: string; url: string } | null;
  selfie: { name: string; url: string } | null;
  plain: string | null;
} {
  if (!raw) return { front: null, back: null, selfie: null, plain: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      front: parsed.front?.url ? parsed.front : null,
      back: parsed.back?.url ? parsed.back : null,
      selfie: parsed.selfie?.url ? parsed.selfie : null,
      plain: null,
    };
  } catch {
    return { front: null, back: null, selfie: null, plain: raw };
  }
}

interface AdminDashboardClientProps {
  adminEmail: string;
  initialStats: AdminSystemStats;
  initialAudits: DoctorAudit[];
  initialDoctors: AdminDoctorEntity[];
  initialPatients: AdminPatientEntity[];
  initialConsultations: AdminConsultationEntity[];
}

export default function AdminDashboardClient({
  adminEmail,
  initialStats,
  initialAudits,
  initialDoctors,
  initialPatients,
  initialConsultations,
}: AdminDashboardClientProps) {
  const [activeModule, setActiveModule] = useState<AdminModuleId>("overview");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Data states
  const [stats, setStats] = useState<AdminSystemStats>(initialStats);
  const [audits, setAudits] = useState<DoctorAudit[]>(initialAudits);
  const [doctors, setDoctors] = useState<AdminDoctorEntity[]>(initialDoctors);
  const [patients, setPatients] = useState<AdminPatientEntity[]>(initialPatients);
  const [consultations, setConsultations] = useState<AdminConsultationEntity[]>(initialConsultations);

  // Filter / Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [doctorSpecialtyFilter, setDoctorSpecialtyFilter] = useState("all");
  const [doctorStatusFilter, setDoctorStatusFilter] = useState("all");
  const [patientStatusFilter, setPatientStatusFilter] = useState("all");
  const [consultationStatusFilter, setConsultationStatusFilter] = useState("all");
  const [auditStatusFilter, setAuditStatusFilter] = useState("all");

  // Inspection modals
  const [selectedAudit, setSelectedAudit] = useState<DoctorAudit | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<AdminDoctorEntity | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<AdminPatientEntity | null>(null);
  const [selectedConsultation, setSelectedConsultation] = useState<AdminConsultationEntity | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Action status states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }

  // Doctor audit actions
  async function handleApproveAudit(audit: DoctorAudit) {
    setActionLoadingId(audit.id);
    try {
      const res = await approveDoctorAudit(audit.id);
      if (res.success) {
        showToast(`Doctor ${audit.firstName || "applicant"} approved successfully!`);
        setAudits((prev) =>
          prev.map((a) => (a.id === audit.id ? { ...a, status: "APPROVED" } : a))
        );
        setSelectedAudit(null);
      } else {
        showToast(res.error || "Approval failed.", "error");
      }
    } catch {
      showToast("An unexpected error occurred during approval.", "error");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleRejectAudit(auditId: string) {
    setActionLoadingId(auditId);
    try {
      const res = await rejectDoctorAudit(auditId, rejectionReason || undefined);
      if (res.success) {
        showToast("Doctor application rejected.");
        setAudits((prev) =>
          prev.map((a) => (a.id === auditId ? { ...a, status: "REJECTED" } : a))
        );
        setSelectedAudit(null);
        setShowRejectModal(false);
        setRejectionReason("");
      } else {
        showToast(res.error || "Rejection failed.", "error");
      }
    } catch {
      showToast("An error occurred during rejection.", "error");
    } finally {
      setActionLoadingId(null);
    }
  }

  // Doctor status toggle
  async function handleToggleDoctor(doc: AdminDoctorEntity) {
    const nextState = !doc.isActive;
    setActionLoadingId(doc.id);
    const res = await toggleDoctorStatus(doc.id, nextState);
    if (res.success) {
      setDoctors((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, isActive: nextState } : d))
      );
      showToast(`Dr. ${doc.name} ${nextState ? "activated" : "suspended"}.`);
    } else {
      showToast(res.error || "Failed to update doctor status.", "error");
    }
    setActionLoadingId(null);
  }

  // Doctor verification toggle
  async function handleToggleDoctorVerification(doc: AdminDoctorEntity) {
    const nextState = !doc.isVerified;
    setActionLoadingId(doc.id);
    const res = await toggleDoctorVerification(doc.id, nextState);
    if (res.success) {
      setDoctors((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, isVerified: nextState } : d))
      );
      showToast(`Dr. ${doc.name} verification ${nextState ? "granted" : "revoked"}.`);
    } else {
      showToast(res.error || "Failed to update verification.", "error");
    }
    setActionLoadingId(null);
  }

  // Patient status toggle
  async function handleTogglePatient(patient: AdminPatientEntity) {
    const nextState = !patient.isActive;
    setActionLoadingId(patient.id);
    const res = await togglePatientStatus(patient.id, nextState);
    if (res.success) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patient.id ? { ...p, isActive: nextState } : p))
      );
      showToast(`Patient ${patient.name} ${nextState ? "activated" : "suspended"}.`);
    } else {
      showToast(res.error || "Failed to update patient status.", "error");
    }
    setActionLoadingId(null);
  }

  // Filtered lists
  const filteredAudits = useMemo(() => {
    return audits.filter((a) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        a.npi.toLowerCase().includes(q) ||
        (a.doctor?.name || "").toLowerCase().includes(q) ||
        (a.doctorEmail || "").toLowerCase().includes(q) ||
        (a.licenseNumber || "").toLowerCase().includes(q) ||
        (a.specialty || "").toLowerCase().includes(q);
      const matchStatus =
        auditStatusFilter === "all" ||
        a.status.toLowerCase() === auditStatusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [audits, searchQuery, auditStatusFilter]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((d) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.npi.toLowerCase().includes(q) ||
        d.specialty.toLowerCase().includes(q);
      const matchSpecialty =
        doctorSpecialtyFilter === "all" ||
        d.specialty.toLowerCase() === doctorSpecialtyFilter.toLowerCase();
      const matchStatus =
        doctorStatusFilter === "all" ||
        (doctorStatusFilter === "active" ? d.isActive : !d.isActive);
      return matchSearch && matchSpecialty && matchStatus;
    });
  }, [doctors, searchQuery, doctorSpecialtyFilter, doctorStatusFilter]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.city || "").toLowerCase().includes(q);
      const matchStatus =
        patientStatusFilter === "all" ||
        (patientStatusFilter === "active" ? p.isActive : !p.isActive);
      return matchSearch && matchStatus;
    });
  }, [patients, searchQuery, patientStatusFilter]);

  const filteredConsultations = useMemo(() => {
    return consultations.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        c.doctorName.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q) ||
        (c.reason || "").toLowerCase().includes(q);
      const matchStatus =
        consultationStatusFilter === "all" ||
        c.status.toLowerCase() === consultationStatusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [consultations, searchQuery, consultationStatusFilter]);

  const pendingAuditsCount = audits.filter(
    (a) => a.status === "PENDING" || a.status === "UNDER_REVIEW"
  ).length;

  const navWithBadges = NAV_ITEMS.map((item) =>
    item.id === "screening" ? { ...item, badge: pendingAuditsCount } : item
  );

  const isDark = theme === "dark";

  return (
    <DashboardShell
      role="admin"
      theme={theme}
      connectionState="connected"
      onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      activeModule={activeModule}
      navItems={navWithBadges}
      title={
        activeModule === "overview"
          ? "Admin Command Center"
          : activeModule === "screening"
          ? "Doctor Screening & Verification"
          : activeModule === "doctors"
          ? "Physician Registry"
          : activeModule === "patients"
          ? "Patient Directory"
          : activeModule === "consultations"
          ? "Consultation Operations"
          : activeModule === "analytics"
          ? "Platform Analytics & Growth"
          : "System Administration"
      }
      subtitle={
        activeModule === "overview"
          ? "Live platform health, operational metrics, and user management."
          : activeModule === "screening"
          ? "Review credentials, licenses, and approve doctor onboarding applications."
          : activeModule === "doctors"
          ? "Manage practicing physicians, specialties, and access permissions."
          : activeModule === "patients"
          ? "Browse registered patients, demographic data, and records."
          : activeModule === "consultations"
          ? "Monitor real-time and completed clinical telehealth encounters."
          : activeModule === "analytics"
          ? "Key performance indicators, specialty distribution, and growth trends."
          : "Security settings, session management, and maintenance controls."
      }
      profile={{
        name: "HealthKo Admin",
        detail: adminEmail,
        isVerified: true,
      }}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
      onNavigate={(mod) => {
        setActiveModule(mod as AdminModuleId);
        setSearchQuery("");
      }}
      onLogout={() => (
        <form action={logoutAdmin}>
          <button
            type="submit"
            className={`w-full rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-[0.2em] transition-colors ${
              theme === "dark"
                ? "bg-slate-850 text-white hover:bg-slate-800"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            Sign Out
          </button>
        </form>
      )}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-white/20 bg-slate-900/95 px-4 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur animate-in fade-in slide-in-from-bottom-4">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              toastMessage.type === "success" ? "bg-emerald-400" : "bg-red-500"
            }`}
          />
          {toastMessage.text}
        </div>
      )}

      {/* ────────────────── MODULE 1: COMMAND CENTER (OVERVIEW) ────────────────── */}
      {activeModule === "overview" && (
        <div className="space-y-6">
          {/* Top KPI Metric Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Patients */}
            <div className={`rounded-2xl border p-5 shadow-xs transition ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Registered Patients</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500/10 text-brand-teal">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </span>
              </div>
              <p className="mt-3 text-3xl font-black">{patients.length}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-emerald-500">{patients.filter((p) => p.isActive).length} active</span>
                <span>·</span>
                <span>{patients.filter((p) => !p.isActive).length} suspended</span>
              </div>
            </div>

            {/* Total Doctors */}
            <div className={`rounded-2xl border p-5 shadow-xs transition ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Practicing Doctors</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-500/10 text-purple-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
                    <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
                    <circle cx="20" cy="10" r="2" />
                  </svg>
                </span>
              </div>
              <p className="mt-3 text-3xl font-black">{doctors.length}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-brand-teal">{doctors.filter((d) => d.isVerified).length} verified</span>
                <span>·</span>
                <span>{doctors.filter((d) => d.isActive).length} active</span>
              </div>
            </div>

            {/* Pending Screenings */}
            <div className={`rounded-2xl border p-5 shadow-xs transition ${
              isDark ? "border-amber-500/30 bg-amber-950/20" : "border-amber-200 bg-amber-50/50"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-500">Pending Screenings</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/20 text-amber-500">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-amber-500">{pendingAuditsCount}</p>
              <button
                type="button"
                onClick={() => setActiveModule("screening")}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-500 hover:underline"
              >
                Review verification queue →
              </button>
            </div>

            {/* Consultations */}
            <div className={`rounded-2xl border p-5 shadow-xs transition ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total Consultations</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/10 text-sky-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M15 10.5 21 7v10l-6-3.5" />
                    <rect x="3" y="6" width="12" height="12" rx="3" />
                  </svg>
                </span>
              </div>
              <p className="mt-3 text-3xl font-black">{consultations.length}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="font-bold text-emerald-500">
                  {consultations.filter((c) => c.status === "COMPLETED").length} completed
                </span>
                <span>·</span>
                <span className="text-sky-500">
                  {consultations.filter((c) => c.status === "CONFIRMED" || c.status === "PENDING").length} upcoming
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Shortcuts Bar */}
          <div className={`rounded-2xl border p-5 ${
            isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50/70"
          }`}>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Operational Quick Actions</h3>
            <div className="mt-3.5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <button
                type="button"
                onClick={() => setActiveModule("screening")}
                className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-left transition hover:bg-amber-500/20"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500 text-slate-950 font-black text-xs">
                  {pendingAuditsCount}
                </span>
                <div>
                  <p className="text-xs font-bold text-amber-300">Doctor Screenings</p>
                  <p className="text-[10px] text-slate-400">Review pending licenses</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule("doctors")}
                className="flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5 text-left transition hover:bg-purple-500/20"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-500 text-white font-black text-xs">
                  {doctors.length}
                </span>
                <div>
                  <p className="text-xs font-bold text-purple-300">Doctors Directory</p>
                  <p className="text-[10px] text-slate-400">Manage physician accounts</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule("patients")}
                className="flex items-center gap-3 rounded-xl border border-teal-500/30 bg-teal-500/10 p-3.5 text-left transition hover:bg-teal-500/20"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-teal text-white font-black text-xs">
                  {patients.length}
                </span>
                <div>
                  <p className="text-xs font-bold text-teal-300">Patient Directory</p>
                  <p className="text-[10px] text-slate-400">Browse platform users</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModule("consultations")}
                className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 text-left transition hover:bg-sky-500/20"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-500 text-white font-black text-xs">
                  {consultations.length}
                </span>
                <div>
                  <p className="text-xs font-bold text-sky-300">Consultation Monitor</p>
                  <p className="text-[10px] text-slate-400">Review active & past sessions</p>
                </div>
              </button>
            </div>
          </div>

          {/* Dual Column: Pending Screenings & Recent Encounters */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pending Screenings Queue */}
            <div className={`rounded-2xl border p-5 shadow-xs ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}>
              <div className="flex items-center justify-between border-b border-slate-700/40 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black">Doctor Verification Queue</h3>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-400">
                    {pendingAuditsCount} Pending
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule("screening")}
                  className="text-xs font-bold text-brand-teal hover:underline"
                >
                  View all →
                </button>
              </div>

              <div className="mt-3.5 divide-y divide-slate-800/40">
                {audits.filter((a) => a.status === "PENDING" || a.status === "UNDER_REVIEW").slice(0, 4).length === 0 ? (
                  <p className="py-8 text-center text-xs font-semibold text-slate-400">
                    No pending doctor credentials to review.
                  </p>
                ) : (
                  audits
                    .filter((a) => a.status === "PENDING" || a.status === "UNDER_REVIEW")
                    .slice(0, 4)
                    .map((audit) => (
                      <div key={audit.id} className="flex items-center justify-between py-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">
                            {audit.doctor?.name || `${audit.firstName || ""} ${audit.lastName || ""}` || "Doctor Applicant"}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {audit.specialty} · Lic #{audit.licenseNumber} ({audit.licenseState})
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAudit(audit);
                            setActiveModule("screening");
                          }}
                          className="shrink-0 rounded-lg bg-brand-teal/20 px-2.5 py-1 text-xs font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition"
                        >
                          Review
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Recent Encounters */}
            <div className={`rounded-2xl border p-5 shadow-xs ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}>
              <div className="flex items-center justify-between border-b border-slate-700/40 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black">Recent Telehealth Encounters</h3>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-300">
                    {consultations.length} Records
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule("consultations")}
                  className="text-xs font-bold text-brand-teal hover:underline"
                >
                  View all →
                </button>
              </div>

              <div className="mt-3.5 divide-y divide-slate-800/40">
                {consultations.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        {c.patientName} ↔ {c.doctorName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {c.doctorSpecialty} · {formatDate(c.scheduledAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        c.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : c.status === "CONFIRMED"
                          ? "bg-brand-teal/20 text-brand-teal"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODULE 2: DOCTOR SCREENING & CREDENTIAL AUDITS ────────────────── */}
      {activeModule === "screening" && (
        <div className="space-y-4">
          {/* Screening Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-400">
                {pendingAuditsCount} Actionable
              </span>
              <span className="text-xs text-slate-400">
                {audits.length} Total Verification Submissions
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, NPI, license..."
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none transition ${
                  isDark ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900 placeholder-slate-400"
                }`}
              />
              <select
                value={auditStatusFilter}
                onChange={(e) => setAuditStatusFilter(e.target.value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none ${
                  isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"
                }`}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Screening Pipeline Cards / Table */}
          <div className={`overflow-hidden rounded-2xl border shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
          }`}>
            <div className="divide-y divide-slate-800/40">
              {filteredAudits.length === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-slate-400">
                  No doctor applications matching the filter criteria.
                </div>
              ) : (
                filteredAudits.map((audit) => {
                  const docPhotos = parseDocumentName(audit.documentName);
                  const isPending = audit.status === "PENDING" || audit.status === "UNDER_REVIEW";

                  return (
                    <div
                      key={audit.id}
                      className="flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center hover:bg-white/5 transition"
                    >
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-400 font-black text-sm">
                          {(audit.doctor?.name || audit.firstName || "Dr")[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">
                            {audit.doctor?.name || `${audit.firstName || ""} ${audit.lastName || ""}` || "Doctor Applicant"}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {audit.doctorEmail || audit.doctor?.email || "No email"} · {audit.specialty}
                          </p>
                        </div>
                      </div>

                      <div className="col-span-3 text-xs">
                        <p className="font-bold">Lic #{audit.licenseNumber} ({audit.licenseState})</p>
                        <p className="text-[10px] text-slate-400">NPI: {audit.npi} · {audit.yearsExp}y Exp</p>
                      </div>

                      <div className="col-span-2">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                            audit.status === "APPROVED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : audit.status === "REJECTED"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {audit.status}
                        </span>
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedAudit(audit)}
                          className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-black text-white hover:bg-teal-600 transition"
                        >
                          Inspect &amp; Verify
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODULE 3: DOCTORS DIRECTORY ────────────────── */}
      {activeModule === "doctors" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-purple-500/20 px-2.5 py-1 text-xs font-black text-purple-300">
                {doctors.length} Physicians
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, specialty, NPI..."
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none ${
                  isDark ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900"
                }`}
              />
              <select
                value={doctorStatusFilter}
                onChange={(e) => setDoctorStatusFilter(e.target.value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none ${
                  isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"
                }`}
              >
                <option value="all">All States</option>
                <option value="active">Active</option>
                <option value="inactive">Suspended</option>
              </select>
            </div>
          </div>

          <div className={`overflow-hidden rounded-2xl border shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
          }`}>
            <div className="divide-y divide-slate-800/40">
              {filteredDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center hover:bg-white/5 transition"
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-500/20 text-purple-300 font-black">
                      {doc.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black truncate">{doc.name}</p>
                        {doc.isVerified && (
                          <span className="text-brand-teal" title="Verified Physician">
                            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{doc.email} · {doc.specialty}</p>
                    </div>
                  </div>

                  <div className="col-span-3 text-xs">
                    <p className="font-bold">NPI: {doc.npi}</p>
                    <p className="text-[10px] text-slate-400">Consultations: {doc.totalConsultations} visits</p>
                  </div>

                  <div className="col-span-2 text-xs">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${
                        doc.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {doc.isActive ? "Active" : "Suspended"}
                    </span>
                  </div>

                  <div className="col-span-3 flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleDoctorVerification(doc)}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-bold hover:bg-white/10 transition"
                      title="Toggle Verified Badge"
                    >
                      {doc.isVerified ? "Revoke Badge" : "Grant Badge"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleDoctor(doc)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-black text-white transition ${
                        doc.isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {doc.isActive ? "Suspend" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODULE 4: PATIENTS DIRECTORY ────────────────── */}
      {activeModule === "patients" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="rounded-lg bg-teal-500/20 px-2.5 py-1 text-xs font-black text-brand-teal">
              {patients.length} Registered Patients
            </span>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient name, email, phone..."
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none ${
                  isDark ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900"
                }`}
              />
              <select
                value={patientStatusFilter}
                onChange={(e) => setPatientStatusFilter(e.target.value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none ${
                  isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"
                }`}
              >
                <option value="all">All States</option>
                <option value="active">Active</option>
                <option value="inactive">Suspended</option>
              </select>
            </div>
          </div>

          <div className={`overflow-hidden rounded-2xl border shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
          }`}>
            <div className="divide-y divide-slate-800/40">
              {filteredPatients.map((pat) => (
                <div
                  key={pat.id}
                  className="flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center hover:bg-white/5 transition"
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/20 text-brand-teal font-black">
                      {pat.firstName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">{pat.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{pat.email} · {pat.phone}</p>
                    </div>
                  </div>

                  <div className="col-span-3 text-xs">
                    <p className="font-bold">DOB: {pat.dob} {pat.gender ? `(${pat.gender})` : ""}</p>
                    <p className="text-[10px] text-slate-400">Total Visits: {pat.totalConsultations}</p>
                  </div>

                  <div className="col-span-2 text-xs">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${
                        pat.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {pat.isActive ? "Active" : "Suspended"}
                    </span>
                  </div>

                  <div className="col-span-3 flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(pat)}
                      className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-bold hover:bg-white/10 transition"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePatient(pat)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-black text-white transition ${
                        pat.isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {pat.isActive ? "Suspend" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODULE 5: CONSULTATIONS LEDGER ────────────────── */}
      {activeModule === "consultations" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-black text-sky-400">
              {consultations.length} Consultations Recorded
            </span>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, doctor, reason..."
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none ${
                  isDark ? "border-slate-700 bg-slate-900 text-white placeholder-slate-500" : "border-slate-300 bg-white text-slate-900"
                }`}
              />
              <select
                value={consultationStatusFilter}
                onChange={(e) => setConsultationStatusFilter(e.target.value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold outline-none ${
                  isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"
                }`}
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className={`overflow-hidden rounded-2xl border shadow-xs ${
            isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
          }`}>
            <div className="divide-y divide-slate-800/40">
              {filteredConsultations.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center hover:bg-white/5 transition"
                >
                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/20 text-sky-400 font-black">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 10.5 21 7v10l-6-3.5" />
                        <rect x="3" y="6" width="12" height="12" rx="3" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate">
                        {c.patientName} ↔ {c.doctorName}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Reason: {c.reason || "General Telehealth Consultation"}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-3 text-xs">
                    <p className="font-bold">{formatDate(c.scheduledAt)}</p>
                    <p className="text-[10px] text-slate-400">Duration: {c.durationMinutes || 25} mins</p>
                  </div>

                  <div className="col-span-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                        c.status === "COMPLETED"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : c.status === "CONFIRMED"
                          ? "bg-brand-teal/20 text-brand-teal"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedConsultation(c)}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-black text-white hover:bg-sky-500 transition"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODULE 6: ANALYTICS & GROWTH ────────────────── */}
      {activeModule === "analytics" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={`rounded-2xl border p-5 ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Doctor Verification Rate</p>
              <p className="mt-2 text-3xl font-black">
                {doctors.length > 0
                  ? `${Math.round((doctors.filter((d) => d.isVerified).length / doctors.length) * 100)}%`
                  : "0%"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {doctors.filter((d) => d.isVerified).length} of {doctors.length} physicians verified
              </p>
            </div>

            <div className={`rounded-2xl border p-5 ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Consultation Completion</p>
              <p className="mt-2 text-3xl font-black">
                {consultations.length > 0
                  ? `${Math.round((consultations.filter((c) => c.status === "COMPLETED").length / consultations.length) * 100)}%`
                  : "0%"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {consultations.filter((c) => c.status === "COMPLETED").length} completed encounters
              </p>
            </div>

            <div className={`rounded-2xl border p-5 ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
            }`}>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Active Patient Ratio</p>
              <p className="mt-2 text-3xl font-black">
                {patients.length > 0
                  ? `${Math.round((patients.filter((p) => p.isActive).length / patients.length) * 100)}%`
                  : "0%"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {patients.filter((p) => p.isActive).length} active patient accounts
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── MODULE 7: ADMIN SETTINGS & SECURITY ────────────────── */}
      {activeModule === "settings" && (
        <div className="max-w-2xl space-y-6">
          <div className={`rounded-2xl border p-6 space-y-4 ${
            isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white"
          }`}>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Admin Credentials &amp; Session</h3>
            <div>
              <p className="text-xs font-semibold text-slate-400">Current Administrator</p>
              <p className="mt-1 text-sm font-bold text-white">{adminEmail}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">Role Authority</p>
              <p className="mt-1 text-sm font-bold text-brand-teal">SUPER_ADMINISTRATOR</p>
            </div>
            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => logoutAdmin()}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700 transition"
              >
                Sign out of Admin Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── INSPECTION MODALS ────────────────── */}

      {/* 1. Doctor Screening & Document Verification Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6 shadow-2xl ${
            isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-center justify-between border-b border-slate-700/40 pb-4">
              <div>
                <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-400">
                  CREDENTIAL SCREENING
                </span>
                <h3 className="mt-1 text-lg font-black">
                  {selectedAudit.doctor?.name || `${selectedAudit.firstName || ""} ${selectedAudit.lastName || ""}` || "Doctor Applicant"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
                className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Audit Details */}
            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/40">
                  <p className="text-[10px] text-slate-400 uppercase font-black">Medical License</p>
                  <p className="mt-1 font-bold">{selectedAudit.licenseNumber} ({selectedAudit.licenseState})</p>
                </div>
                <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/40">
                  <p className="text-[10px] text-slate-400 uppercase font-black">NPI Number</p>
                  <p className="mt-1 font-bold">{selectedAudit.npi}</p>
                </div>
                <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/40">
                  <p className="text-[10px] text-slate-400 uppercase font-black">Specialty</p>
                  <p className="mt-1 font-bold">{selectedAudit.specialty}</p>
                </div>
                <div className="rounded-xl border border-slate-800 p-3 bg-slate-950/40">
                  <p className="text-[10px] text-slate-400 uppercase font-black">Graduation &amp; School</p>
                  <p className="mt-1 font-bold">{selectedAudit.medicalSchool} ({selectedAudit.gradYear})</p>
                </div>
              </div>

              {/* Uploaded Verification Documents */}
              {(() => {
                const docObj = parseDocumentName(selectedAudit.documentName);
                const hasDocs = docObj.front || docObj.back || docObj.selfie;
                return (
                  <div className="rounded-xl border border-slate-800 p-3.5 bg-slate-950/40">
                    <p className="text-[10px] text-slate-400 uppercase font-black mb-2">Uploaded Verification Documents</p>
                    {hasDocs ? (
                      <div className="grid grid-cols-3 gap-3">
                        {docObj.front && (
                          <a
                            href={docObj.front.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col items-center gap-1.5 rounded-lg border border-slate-800 p-2 text-center hover:border-brand-teal transition"
                          >
                            <img src={docObj.front.url} alt="ID Front" className="h-16 w-full object-cover rounded" />
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-brand-teal">PRC ID Front</span>
                          </a>
                        )}
                        {docObj.back && (
                          <a
                            href={docObj.back.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col items-center gap-1.5 rounded-lg border border-slate-800 p-2 text-center hover:border-brand-teal transition"
                          >
                            <img src={docObj.back.url} alt="ID Back" className="h-16 w-full object-cover rounded" />
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-brand-teal">PRC ID Back</span>
                          </a>
                        )}
                        {docObj.selfie && (
                          <a
                            href={docObj.selfie.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-col items-center gap-1.5 rounded-lg border border-slate-800 p-2 text-center hover:border-brand-teal transition"
                          >
                            <img src={docObj.selfie.url} alt="Selfie" className="h-16 w-full object-cover rounded" />
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-brand-teal">Selfie Verification</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No image documents uploaded.</p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Action Bar */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
              >
                Reject Application
              </button>

              <button
                type="button"
                onClick={() => handleApproveAudit(selectedAudit)}
                disabled={actionLoadingId === selectedAudit.id}
                className="rounded-xl bg-brand-teal px-5 py-2 text-xs font-black text-white hover:bg-teal-600 transition shadow-lg shadow-teal-500/20"
              >
                {actionLoadingId === selectedAudit.id ? "Approving..." : "Approve & Activate Doctor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Rejection Reason Modal */}
      {showRejectModal && selectedAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl text-white">
            <h4 className="text-sm font-black text-red-400">Reject Application</h4>
            <p className="mt-1 text-xs text-slate-400">
              Provide an optional reason for rejecting Dr. {selectedAudit.doctor?.name || selectedAudit.firstName || ""}.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. PRC License invalid or expired..."
              className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs outline-none focus:border-red-500"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRejectAudit(selectedAudit.id)}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-black text-white hover:bg-red-700"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black">{selectedPatient.name}</h3>
              <button type="button" onClick={() => setSelectedPatient(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/50">
                  <p className="text-[10px] text-slate-400 font-bold">Email</p>
                  <p className="mt-0.5 font-semibold truncate">{selectedPatient.email}</p>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/50">
                  <p className="text-[10px] text-slate-400 font-bold">Phone</p>
                  <p className="mt-0.5 font-semibold">{selectedPatient.phone}</p>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/50">
                  <p className="text-[10px] text-slate-400 font-bold">DOB &amp; Gender</p>
                  <p className="mt-0.5 font-semibold">{selectedPatient.dob} ({selectedPatient.gender || "—"})</p>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/50">
                  <p className="text-[10px] text-slate-400 font-bold">Blood Type</p>
                  <p className="mt-0.5 font-semibold">{selectedPatient.bloodType || "Not recorded"}</p>
                </div>
              </div>
              {selectedPatient.emergencyContact && (
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/50">
                  <p className="text-[10px] text-slate-400 font-bold">Emergency Contact</p>
                  <p className="mt-0.5 font-semibold">{selectedPatient.emergencyContact}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Consultation Detail Modal */}
      {selectedConsultation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black">Consultation Encounter Record</h3>
              <button type="button" onClick={() => setSelectedConsultation(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <p className="text-[10px] text-slate-400 font-bold">Participants</p>
                <p className="mt-1 font-bold text-brand-teal">{selectedConsultation.patientName} (Patient) ↔ {selectedConsultation.doctorName} ({selectedConsultation.doctorSpecialty})</p>
              </div>
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <p className="text-[10px] text-slate-400 font-bold">Reason for Visit</p>
                <p className="mt-1 font-semibold">{selectedConsultation.reason || "General Telehealth Consultation"}</p>
              </div>
              {selectedConsultation.notes && (
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                  <p className="text-[10px] text-slate-400 font-bold">Clinical Notes</p>
                  <p className="mt-1 whitespace-pre-line text-slate-300">{selectedConsultation.notes}</p>
                </div>
              )}
              {selectedConsultation.prescription && (
                <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-950/20">
                  <p className="text-[10px] text-purple-400 font-bold">Official Prescription</p>
                  <p className="mt-1 whitespace-pre-line text-purple-200 font-mono">{selectedConsultation.prescription}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
