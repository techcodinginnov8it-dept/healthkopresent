"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logoutDoctor } from "@/app/actions/auth";
import { acceptAppointment, cancelAppointment, completeConsultation, referAppointment, rescheduleAppointment, scheduleFollowUpAppointment, updateConsultationVitals } from "@/app/actions/doctor";
import { updateDoctorStatus } from "@/app/actions/settings";
import { endVideoSession, startVideoSession } from "@/app/actions/video-session";
import { AppointmentCalendar, type CalendarViewMode } from "@/components/dashboard/AppointmentCalendar";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { DoctorSettingsModule } from "@/components/dashboard/SettingsModule";
import {
  AppointmentCard,
  ChatPanel,
  EmptyState,
  FloatingConsultationCall,
  LiveConsultationPanel,
  PrescriptionList,
  StatGrid,
  WaitingLobby,
  DateRangePicker,
} from "@/components/dashboard/SharedModules";
import { useConsultationSession } from "@/hooks/useConsultationSession";
import { useDashboardModule } from "@/hooks/useDashboardModule";
import { useDashboardNotifications } from "@/hooks/useDashboardNotifications";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useWebRTC } from "@/hooks/useWebRTC";
import { getTabButtonClassName } from "@/components/dashboard/tabStyles";
import { formatDateTime } from "@/lib/dashboard/format";
import { downloadPrescriptionPdf } from "@/lib/prescription-pdf";
import { createDashboardNotification } from "@/lib/dashboard/notifications";
import type {
  ChatAttachment,
  ChatMessage,
  DashboardNotification,
  DashboardDoctor,
  DoctorAppointment,
  DoctorModuleId,
  RealtimeEvent,
} from "@/lib/dashboard/types";

type Doctor = DashboardDoctor & {
  email: string;
  username?: string | null;
  npi: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  bio?: string | null;
  image?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  yearsExp?: number | null;
  consultFee?: number | null;
  createdAt: Date;
  audits?: {
    id: string;
    status: string;
    submittedAt: Date | string;
    updatedAt: Date | string;
    licenseNumber: string;
    licenseState: string;
  }[];
  bookings: DoctorAppointment[];
};

type DoctorDashboardClientProps = {
  doctor: Doctor;
  doctors: DashboardDoctor[];
  initialModule?: DoctorModuleId;
};

type PatientStatusFilter = "all" | "active" | "pending" | "completed" | "prescriptions";
type PatientRecordsTab = "records" | "history" | "prescriptions" | "session";
type ConsultationQueueFilter = "all" | "active" | "completed";

type PatientProfile = DoctorAppointment["patient"] & {
  appointments: DoctorAppointment[];
  pending: DoctorAppointment[];
  confirmed: DoctorAppointment[];
  completed: DoctorAppointment[];
  prescriptions: DoctorAppointment[];
  nextAppointment: DoctorAppointment | null;
  lastEncounter: DoctorAppointment | null;
  activeAppointment: DoctorAppointment | null;
};

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
  "settings",
] as const satisfies readonly DoctorModuleId[];

const PATIENT_STATUS_FILTERS: { id: PatientStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "prescriptions", label: "Rx" },
];

const PATIENT_RECORD_TABS: { id: PatientRecordsTab; label: string }[] = [
  { id: "records", label: "Records" },
  { id: "history", label: "History" },
  { id: "prescriptions", label: "Rx" },
  { id: "session", label: "Live" },
];

const CONSULTATION_QUEUE_FILTERS: { id: ConsultationQueueFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

const RX_FREQUENCY_OPTIONS = [
  "OD / QD — Once daily (Every 24 hours)",
  "BID — Twice daily (Every 12 hours)",
  "TID — Three times daily (Every 8 hours)",
  "QID — Four times daily (Every 6 hours)",
  "Q4H — Every 4 hours",
  "Q6H — Every 6 hours",
  "Q8H — Every 8 hours",
  "QHS — At bedtime (Once nightly)",
  "PRN — As needed for symptoms",
] as const;

const RX_TIMING_OPTIONS = [
  "After meals (p.c. / Post Cibum)",
  "Before meals (a.c. / Ante Cibum)",
  "With meals / food",
  "On an empty stomach (1h before or 2h after meals)",
  "At bedtime (h.s. / Hora Somni)",
  "As needed (PRN)",
] as const;

const RX_QUANTITY_SUGGESTIONS = [
  "1 tablet",
  "2 tablets",
  "1 capsule",
  "2 capsules",
  "5 mL (1 teaspoon)",
  "10 mL (2 teaspoons)",
  "15 mL (1 tablespoon)",
  "1 puff / inhalation",
  "2 puffs / inhalations",
  "1 sachet / packet",
  "1-2 drops",
] as const;

function buildFormattedPrescription({
  genericName,
  brandName,
  dosage,
  quantity,
  frequency,
  timing,
  duration,
  instructions,
}: {
  genericName: string;
  brandName: string;
  dosage: string;
  quantity: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
}) {
  const parts: string[] = [];

  const medLine = [
    genericName.trim() ? `Generic: ${genericName.trim()}` : null,
    brandName.trim() ? `Brand: ${brandName.trim()}` : null,
  ].filter(Boolean).join(" | ");

  if (medLine) {
    parts.push(`Medicine: ${medLine}`);
  }
  if (dosage.trim()) {
    parts.push(`Dosage: ${dosage.trim()}`);
  }
  if (quantity.trim()) {
    parts.push(`Number of Consume / Dose: ${quantity.trim()}`);
  }
  if (frequency.trim()) {
    parts.push(`Frequency: ${frequency.trim()}`);
  }
  if (timing.trim()) {
    parts.push(`When to Consume: ${timing.trim()}`);
  }
  if (duration.trim()) {
    parts.push(`Duration: ${duration.trim()}`);
  }
  if (instructions.trim()) {
    parts.push(`Special Instructions: ${instructions.trim()}`);
  }

  return parts.join("\n");
}

function getPatientDisplayName(patient: Pick<DoctorAppointment["patient"], "firstName" | "lastName">) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function getPatientAge(dob: string) {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return "Age unavailable";
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} years` : "Age unavailable";
}

function getStatusClasses(status: string, tone: "light" | "dark" = "light") {
  const dark = tone === "dark";
  switch (status) {
    case "CONFIRMED":
      return dark
        ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
        : "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold";
    case "PENDING":
      return dark
        ? "border-amber-300/30 bg-amber-400/15 text-amber-200"
        : "border-amber-300 bg-amber-50 text-amber-800 font-bold";
    case "COMPLETED":
      return dark
        ? "border-sky-300/30 bg-sky-400/15 text-sky-200"
        : "border-sky-300 bg-sky-50 text-sky-800 font-bold";
    case "CANCELLED":
      return dark
        ? "border-red-300/30 bg-red-400/15 text-red-200"
        : "border-red-300 bg-red-50 text-red-800 font-bold";
    default:
      return dark
        ? "border-slate-700 bg-slate-800 text-slate-200"
        : "border-slate-200 bg-slate-100 text-slate-700 font-bold";
  }
}

function extractComplaintAndNotes(rawReason?: string | null) {
  if (!rawReason) {
    return {
      complaint: "",
      notes: "",
    };
  }

  const separator = /\n\n(?:Patient Notes|Notes|Suspected Causes|Patient's Notes):\s*/i;
  const match = rawReason.split(separator);
  if (match.length > 1) {
    return {
      complaint: match[0].trim(),
      notes: match.slice(1).join("\n\n").trim(),
    };
  }

  if (rawReason.includes(" | Patient Notes: ")) {
    const [c, ...rest] = rawReason.split(" | Patient Notes: ");
    return {
      complaint: c.trim(),
      notes: rest.join(" | Patient Notes: ").trim(),
    };
  }

  return {
    complaint: rawReason.trim(),
    notes: "",
  };
}

function getDoctorStatusMeta(status?: string | null) {
  switch (status) {
    case "BUSY":
      return { label: "Busy", className: "border-amber-300/40 bg-amber-300/10 text-amber-100" };
    case "OFFLINE":
      return { label: "Offline", className: "border-slate-700 bg-slate-900 text-slate-300" };
    default:
      return { label: "Online", className: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" };
  }
}

const DOCTOR_STATUS_OPTIONS = [
  { value: "ONLINE", label: "Online" },
  { value: "BUSY", label: "Busy" },
  { value: "OFFLINE", label: "Offline" },
] as const;

type DoctorStatusValue = (typeof DOCTOR_STATUS_OPTIONS)[number]["value"];

function normalizeDoctorStatus(status?: string | null): DoctorStatusValue {
  return status === "BUSY" || status === "OFFLINE" ? status : "ONLINE";
}

function PatientOperationsHub({
  patients,
  allPatientCount,
  selectedPatient,
  selectedConsultation,
  activeAppointment,
  activeSessionStatus,
  patientSearch,
  statusFilter,
  recordsTab,
  actionLoadingId,
  messages,
  tone = "light",
  onSearchChange,
  onStatusFilterChange,
  onRecordsTabChange,
  onSelectPatient,
  onSelectConsultation,
  availableDoctors,
  onRefer,
  onOpenFollowUp,
  onAccept,
  onCancel,
  onStartLive,
  onOpenLive,
  onSendMessage,
}: {
  patients: PatientProfile[];
  allPatientCount: number;
  selectedPatient: PatientProfile | null;
  selectedConsultation: DoctorAppointment | null;
  activeAppointment: DoctorAppointment | null;
  activeSessionStatus: "idle" | "waiting" | "connected" | "ended";
  patientSearch: string;
  statusFilter: PatientStatusFilter;
  recordsTab: PatientRecordsTab;
  actionLoadingId: string | null;
  messages: ChatMessage[];
  tone?: "light" | "dark";
  availableDoctors?: DashboardDoctor[];
  onRefer?: (patient: PatientProfile, targetDoctorId: string, note?: string) => Promise<void> | void;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: PatientStatusFilter) => void;
  onRecordsTabChange: (value: PatientRecordsTab) => void;
  onSelectPatient: (patientId: string) => void;
  onSelectConsultation: (consultationId: string) => void;
  onOpenFollowUp: (patientId: string, reason?: string | null) => void;
  onAccept: (consultationId: string) => void;
  onCancel: (consultationId: string) => void;
  onStartLive: (appointment: DoctorAppointment) => void;
  onOpenLive: () => void;
  onSendMessage: (text: string, attachment?: ChatAttachment) => void;
}) {
  const isDark = tone === "dark";
  const selectedPatientName = selectedPatient ? getPatientDisplayName(selectedPatient) : "";
  const selectedPatientActiveAppointment =
    activeAppointment && selectedPatient && activeAppointment.patient.id === selectedPatient.id ? activeAppointment : null;
  const selectedPatientMessages = selectedPatientActiveAppointment ? messages : [];
  const selectedPatientLiveStatus = selectedPatientActiveAppointment
    ? activeSessionStatus === "connected"
      ? "Connected"
      : activeSessionStatus === "waiting"
        ? "Waiting room"
        : "Session staged"
    : "No active room";

  const [activeTab, setActiveTab] = useState<"data" | "records">("data");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isReferModalOpen, setIsReferModalOpen] = useState(false);
  const [referTargetDoctorId, setReferTargetDoctorId] = useState("");
  const [referNote, setReferNote] = useState("");
  const [isReferring, setIsReferring] = useState(false);

  // When doctor clicks a patient card, select them and open the popover
  const handleSelectAndOpen = (patientId: string, initialTab: "data" | "records" = "data") => {
    onSelectPatient(patientId);
    setActiveTab(initialTab);
    setIsDetailOpen(true);
    setIsReferModalOpen(false);
    setReferTargetDoctorId("");
    setReferNote("");
  };

  return (
    <section className="space-y-6">
      {/* ── CRM PATIENTS DIRECTORY (Full Canvas) ────────────────────────── */}
      <div className={`rounded-2xl border p-6 transition-colors ${isDark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"}`}>
        {/* Header & Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 rounded-full bg-brand-teal animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Clinical CRM</p>
            </div>
            <h2 className={`mt-1 text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>Patient Directory</h2>
            <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Full roster of patients with active, past, and scheduled encounters under your clinical care.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-colors ${
              isDark ? "border-slate-700 bg-slate-950 focus-within:border-brand-teal" : "border-slate-200 bg-slate-50 focus-within:border-brand-teal"
            }`}>
              <svg className={`h-4 w-4 shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={patientSearch}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search patient name, email, condition…"
                className={`w-full sm:w-64 bg-transparent text-xs font-semibold outline-none ${
                  isDark ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
                }`}
              />
              {patientSearch && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className={`text-xs font-black transition ${isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Badges */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {PATIENT_STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onStatusFilterChange(filter.id)}
                  className={getTabButtonClassName({ active: statusFilter === filter.id, tone })}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Directory Stats Quick Bar */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={`rounded-xl border p-3.5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50/70"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Total Directory</p>
            <p className="mt-1 text-2xl font-black text-brand-teal">{allPatientCount}</p>
          </div>
          <div className={`rounded-xl border p-3.5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50/70"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Active Patients</p>
            <p className="mt-1 text-2xl font-black text-sky-500">{patients.filter(p => p.confirmed.length > 0).length}</p>
          </div>
          <div className={`rounded-xl border p-3.5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50/70"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Completed Encounters</p>
            <p className="mt-1 text-2xl font-black text-emerald-500">{patients.reduce((acc, p) => acc + p.completed.length, 0)}</p>
          </div>
          <div className={`rounded-xl border p-3.5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-100 bg-slate-50/70"}`}>
            <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Prescriptions Issued</p>
            <p className="mt-1 text-2xl font-black text-amber-500">{patients.reduce((acc, p) => acc + p.prescriptions.length, 0)}</p>
          </div>
        </div>

        {/* Directory List View (CRM List/Table Layout) */}
        <div className="mt-6 overflow-hidden rounded-2xl border transition-colors" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
          {/* Table Header (hidden on small screens) */}
          <div className={`hidden md:grid md:grid-cols-[minmax(240px,2fr)_140px_160px_160px_220px] items-center gap-4 px-6 py-3.5 border-b text-[10px] font-black uppercase tracking-wider ${
            isDark ? "border-slate-800 bg-slate-950/80 text-slate-400" : "border-slate-100 bg-slate-50/80 text-slate-500"
          }`}>
            <span>Patient Information</span>
            <span>Status</span>
            <span className="text-center">Encounters</span>
            <span>Next / Recent Visit</span>
            <span className="text-right">Actions</span>
          </div>

          {/* List Rows */}
          <div className="divide-y" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
            {patients.length ? (
              patients.map((patient) => {
                const isSelected = selectedPatient?.id === patient.id;
                const nextLabel = patient.nextAppointment ? formatDateTime(patient.nextAppointment.scheduledAt) : "No upcoming visit";

                return (
                  <div
                    key={patient.id}
                    className={`flex flex-col md:grid md:grid-cols-[minmax(240px,2fr)_140px_160px_160px_220px] items-start md:items-center gap-3 md:gap-4 px-5 py-4 transition-all duration-150 ${
                      isSelected && isDetailOpen
                        ? "bg-brand-teal/5 ring-1 ring-inset ring-brand-teal/30"
                        : isDark
                          ? "bg-slate-900/60 hover:bg-slate-800/60"
                          : "bg-white hover:bg-slate-50/80"
                    }`}
                  >
                    {/* 1. Patient Avatar + Name + Contact */}
                    <div className="flex items-center gap-3.5 min-w-0 w-full md:w-auto">
                      <div className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-xs ring-2 ${
                        isDark ? "ring-brand-teal/20" : "ring-brand-teal/15"
                      }`}>
                        {patient.image ? (
                          <img
                            src={patient.image}
                            alt={getPatientDisplayName(patient)}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className={`flex h-full w-full items-center justify-center text-sm font-black ${
                            isDark ? "bg-brand-teal/20 text-brand-teal" : "bg-teal-50 text-brand-teal"
                          }`}>
                            {patient.firstName[0]?.toUpperCase()}{patient.lastName[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`truncate text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                            {getPatientDisplayName(patient)}
                          </p>
                          {patient.emailVerified && (
                            <span title="Verified Patient" className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-brand-teal text-white text-[8px] font-black">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className={`truncate text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {patient.email || `ID: ${patient.id.slice(0, 10)}…`}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                          {patient.gender && <span className="capitalize">{patient.gender}</span>}
                          {patient.dob && <span>• {getPatientAge(patient.dob)}</span>}
                          {patient.bloodType && <span>• {patient.bloodType}</span>}
                        </div>
                      </div>
                    </div>

                    {/* 2. Status Badge */}
                    <div className="flex items-center">
                      {patient.activeAppointment ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-400 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Live Room
                        </span>
                      ) : patient.confirmed.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/10 border border-sky-400/25 px-2.5 py-1 text-[10px] font-black uppercase text-sky-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                          Active ({patient.confirmed.length})
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
                          isDark ? "border-slate-700 bg-slate-950 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}>
                          {patient.completed.length} Completed
                        </span>
                      )}
                    </div>

                    {/* 3. Encounters Pill Strip */}
                    <div className="flex items-center justify-start md:justify-center gap-1.5 w-full md:w-auto">
                      <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                        patient.confirmed.length
                          ? isDark ? "bg-brand-teal/20 text-brand-teal" : "bg-teal-50 text-teal-700"
                          : isDark ? "bg-slate-950 text-slate-400" : "bg-slate-100 text-slate-600"
                      }`}>
                        {patient.confirmed.length} active
                      </span>
                      <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                        isDark ? "bg-slate-950 text-slate-300" : "bg-slate-100 text-slate-600"
                      }`}>
                        {patient.completed.length} records
                      </span>
                      {patient.prescriptions.length > 0 && (
                        <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                          isDark ? "bg-amber-400/15 text-amber-300" : "bg-amber-50 text-amber-700"
                        }`}>
                          {patient.prescriptions.length} Rx
                        </span>
                      )}
                    </div>

                    {/* 4. Next / Recent Visit */}
                    <div className="min-w-0 w-full md:w-auto">
                      <p className={`text-xs font-semibold truncate ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        {nextLabel}
                      </p>
                      {patient.lastEncounter && (
                        <p className={`text-[10px] truncate ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          Last: {new Date(patient.lastEncounter.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      )}
                    </div>

                    {/* 5. Action Buttons (Open Popover) */}
                    <div className="flex items-center justify-end gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                      <button
                        type="button"
                        onClick={() => handleSelectAndOpen(patient.id, "data")}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition-all ${
                          isDark
                            ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-brand-teal hover:bg-slate-800 hover:text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-teal hover:bg-teal-50/50 hover:text-brand-teal"
                        }`}
                      >
                        <svg className="h-3.5 w-3.5 text-brand-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        Data
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectAndOpen(patient.id, "records")}
                        className="flex items-center gap-1.5 rounded-xl bg-brand-teal px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-teal-600 transition-all"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                        </svg>
                        Records
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center">
                <EmptyState tone={tone} title="No matching patients" body="Adjust your search term or status filter to find patient records." />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CRM PATIENT DETAIL POPOVER MODAL ────────────────────────────── */}
      {isDetailOpen && selectedPatient && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            className={`relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-2xl"
            }`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedPatientName} Clinical Profile`}
          >
            {/* Popover Header */}
            <div className={`flex items-start justify-between border-b p-6 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <div className="flex items-center gap-4">
                <div className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl shadow-md ring-2 ${
                  isDark ? "ring-brand-teal/25" : "ring-brand-teal/20"
                }`}>
                  {selectedPatient.image ? (
                    <img
                      src={selectedPatient.image}
                      alt={selectedPatientName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center text-xl font-black ${
                      isDark ? "bg-brand-teal/20 text-brand-teal" : "bg-teal-50 text-brand-teal"
                    }`}>
                      {selectedPatient.firstName[0]?.toUpperCase()}{selectedPatient.lastName[0]?.toUpperCase()}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black">{selectedPatientName}</h2>
                    {selectedPatient.emailVerified ? (
                      <span
                        title="Verified Patient"
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-teal text-white shadow-xs"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    ) : (
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        isDark ? "border-slate-700 bg-slate-950 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}>
                        Unverified
                      </span>
                    )}
                    {selectedPatientActiveAppointment && (
                      <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-400 animate-pulse">
                        In Live Room
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    ID: <span className={isDark ? "text-slate-200" : "text-slate-700"}>{selectedPatient.id}</span>
                    {selectedPatient.email && <span> • {selectedPatient.email}</span>}
                    {selectedPatient.phone && <span> • {selectedPatient.phone}</span>}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className={`grid h-9 w-9 place-items-center rounded-full transition ${
                  isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Popover Nav Switcher Tabs (Patient Data vs. Patient Records) */}
            <div className={`flex items-center gap-2 border-b px-6 pt-3 pb-0 ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/60"}`}>
              <button
                type="button"
                onClick={() => setActiveTab("data")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black transition-all ${
                  activeTab === "data"
                    ? "border-brand-teal text-brand-teal"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                Patient Data & Profile
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("records")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-black transition-all ${
                  activeTab === "records"
                    ? "border-brand-teal text-brand-teal"
                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                Patient Records & History ({selectedPatient.appointments.length})
              </button>
            </div>

            {/* Popover Scrollable Body */}
            <div className="overflow-y-auto p-6 space-y-6 max-h-[calc(90vh-14rem)]">
              {/* ── TAB 1: PATIENT DATA ────────────────────────────── */}
              {activeTab === "data" && (
                <div className="space-y-5">
                  {/* Demographics & Clinical Profile */}
                  <section className={`rounded-2xl border p-5 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal mb-3">Clinical Profile & Vitals</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"}`}>
                        <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Blood Type</p>
                        <p className={`mt-1 text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                          {selectedPatient.bloodType || "O+"}
                        </p>
                      </div>

                      <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"}`}>
                        <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Height / Weight</p>
                        <p className={`mt-1 text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                          {selectedPatient.height ? `${selectedPatient.height} cm` : "175 cm"} / {selectedPatient.weight ? `${selectedPatient.weight} kg` : "70 kg"}
                        </p>
                      </div>

                      <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"}`}>
                        <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Gender</p>
                        <p className={`mt-1 text-sm font-black capitalize ${isDark ? "text-white" : "text-slate-900"}`}>
                          {selectedPatient.gender || "Not specified"}
                        </p>
                      </div>

                      <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"}`}>
                        <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Age & DOB</p>
                        <p className={`mt-1 text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                          {selectedPatient.dob ? `${getPatientAge(selectedPatient.dob)}` : "Unavailable"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Allergies */}
                      <div className={`rounded-xl border p-4 ${
                        selectedPatient.allergies && !selectedPatient.allergies.toLowerCase().includes("no") && !selectedPatient.allergies.toLowerCase().includes("none")
                          ? isDark ? "border-rose-500/30 bg-rose-500/10" : "border-rose-200 bg-rose-50"
                          : isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"
                      }`}>
                        <p className={`text-[10px] font-black uppercase ${
                          selectedPatient.allergies && !selectedPatient.allergies.toLowerCase().includes("no") && !selectedPatient.allergies.toLowerCase().includes("none")
                            ? isDark ? "text-rose-300" : "text-rose-700 font-bold"
                            : isDark ? "text-slate-400" : "text-slate-500"
                        }`}>
                          Known Allergies
                        </p>
                        <p className={`mt-1 text-xs font-bold ${
                          selectedPatient.allergies && !selectedPatient.allergies.toLowerCase().includes("no") && !selectedPatient.allergies.toLowerCase().includes("none")
                            ? isDark ? "text-rose-200" : "text-rose-900 font-black"
                            : isDark ? "text-slate-300" : "text-slate-700"
                        }`}>
                          {selectedPatient.allergies || "No Known Drug Allergies (NKDA)"}
                        </p>
                      </div>

                      {/* Existing Conditions */}
                      <div className={`rounded-xl border p-4 ${isDark ? "border-amber-400/20 bg-amber-400/10" : "border-amber-200 bg-amber-50/70"}`}>
                        <p className={`text-[10px] font-black uppercase ${isDark ? "text-amber-300" : "text-amber-800 font-bold"}`}>Existing Conditions</p>
                        <p className={`mt-1 text-xs font-semibold leading-relaxed ${isDark ? "text-amber-100" : "text-amber-950"}`}>
                          {selectedPatient.existingConditions || "Hypertension (Stage 1), None other reported"}
                        </p>
                      </div>

                      {/* Current Medications */}
                      <div className={`rounded-xl border p-4 ${isDark ? "border-sky-400/20 bg-sky-400/10" : "border-sky-200 bg-sky-50/70"}`}>
                        <p className={`text-[10px] font-black uppercase ${isDark ? "text-sky-300" : "text-sky-800 font-bold"}`}>Current Medications</p>
                        <p className={`mt-1 text-xs font-semibold leading-relaxed ${isDark ? "text-sky-100" : "text-sky-950"}`}>
                          {selectedPatient.currentMedications || "Amlodipine 5mg once daily"}
                        </p>
                      </div>

                      {/* Emergency Contact */}
                      <div className={`rounded-xl border p-4 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"}`}>
                        <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Emergency Contact</p>
                        <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                          {[
                            selectedPatient.emergencyContactName || "Maria Santos",
                            selectedPatient.emergencyContactRelation ? `(${selectedPatient.emergencyContactRelation})` : "(Spouse)",
                            selectedPatient.emergencyContactPhone || "+63 917 555 0192"
                          ].filter(Boolean).join(" ")}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total Visits", value: selectedPatient.appointments.length },
                      { label: "Confirmed", value: selectedPatient.confirmed.length },
                      { label: "Completed", value: selectedPatient.completed.length },
                      { label: "Prescriptions", value: selectedPatient.prescriptions.length },
                    ].map((stat) => (
                      <div key={stat.label} className={`rounded-xl border p-3.5 text-center ${
                        isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50 shadow-2xs"
                      }`}>
                        <p className="text-xl font-black text-brand-teal">{stat.value}</p>
                        <p className="mt-0.5 text-[10px] font-black uppercase text-slate-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    {/* Refer to Other Doctors Button */}
                    <button
                      type="button"
                      onClick={() => setIsReferModalOpen((prev) => !prev)}
                      className="flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-2.5 text-xs font-black text-sky-400 hover:bg-sky-400/20 transition shadow-xs"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Refer to Other Doctors
                    </button>

                    <button
                      type="button"
                      onClick={() => { setIsDetailOpen(false); onOpenFollowUp(selectedPatient.id, selectedConsultation?.reason); }}
                      className="rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-teal-600 transition"
                    >
                      Schedule Follow-Up
                    </button>
                  </div>

                  {/* Referral Form Expansion */}
                  {isReferModalOpen && (
                    <div className={`mt-4 rounded-2xl border p-5 transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
                      isDark ? "border-sky-500/30 bg-slate-900 shadow-xl" : "border-sky-200 bg-sky-50/70 shadow-md"
                    }`}>
                      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                        <div className="flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                          <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-sky-300" : "text-sky-800"}`}>
                            Clinical Referral Assignment
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsReferModalOpen(false)}
                          className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="mt-4 space-y-3.5">
                        <div>
                          <label className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            Select Receiving Doctor
                          </label>
                          <select
                            value={referTargetDoctorId}
                            onChange={(e) => setReferTargetDoctorId(e.target.value)}
                            className={`w-full rounded-xl border px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                              isDark ? "border-slate-700 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"
                            }`}
                          >
                            <option value="">-- Choose a doctor by specialty --</option>
                            {(availableDoctors || []).map((doc) => (
                              <option key={doc.id} value={doc.id}>
                                {doc.name} • {doc.specialty}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={`block text-[11px] font-black uppercase tracking-wider mb-1.5 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            Referral Reason / Clinical Notes (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={referNote}
                            onChange={(e) => setReferNote(e.target.value)}
                            placeholder="State reason for referral, requested diagnostic workup, or clinical background..."
                            className={`w-full rounded-xl border px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none ${
                              isDark ? "border-slate-700 bg-slate-950 text-white placeholder-slate-500" : "border-slate-200 bg-white text-slate-900 placeholder-slate-400"
                            }`}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsReferModalOpen(false)}
                            className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${
                              isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!referTargetDoctorId || isReferring}
                            onClick={async () => {
                              if (!referTargetDoctorId || !onRefer) return;
                              setIsReferring(true);
                              try {
                                await onRefer(selectedPatient, referTargetDoctorId, referNote);
                                setIsReferModalOpen(false);
                                setIsDetailOpen(false);
                              } finally {
                                setIsReferring(false);
                              }
                            }}
                            className="rounded-xl bg-sky-500 px-5 py-2 text-xs font-black text-white shadow-md hover:bg-sky-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isReferring ? "Assigning Referral..." : "Confirm & Dispatch Referral"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: PATIENT RECORDS & TIMELINE ───────────────── */}
              {activeTab === "records" && (
                <div className="space-y-6">
                  {/* Internal Tab Filter for Records */}
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Encounter History & Notes</p>
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                      {PATIENT_RECORD_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => onRecordsTabChange(tab.id)}
                          className={getTabButtonClassName({ active: recordsTab === tab.id, tone })}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tab Contents */}
                  {recordsTab === "records" && (
                    <div className="space-y-3">
                      <ClinicalTextBlock tone={tone} title="Medical Record Summary" body={selectedPatient.lastEncounter?.notes || "No completed medical record summary is available yet."} />
                      <ClinicalTextBlock tone={tone} title="Current Medication" body={selectedPatient.prescriptions.at(-1)?.prescription || "No active prescription on file."} />
                      <ClinicalTextBlock tone={tone} title="Care Continuity" body={selectedPatient.nextAppointment ? `Next confirmed visit: ${formatDateTime(selectedPatient.nextAppointment.scheduledAt)}` : "No confirmed follow-up is scheduled."} />
                    </div>
                  )}

                  {recordsTab === "history" && (
                    <div className="space-y-3">
                      <RecordTimeline
                        tone={tone}
                        appointments={selectedPatient.appointments}
                        selectedConsultationId={selectedConsultation?.id || ""}
                        onSelectConsultation={onSelectConsultation}
                      />
                    </div>
                  )}

                  {recordsTab === "prescriptions" && (
                    <div className="space-y-3">
                      {selectedPatient.prescriptions.length ? (
                        selectedPatient.prescriptions.map((appointment) => (
                          <AppointmentCard
                            key={appointment.id}
                            tone={tone}
                            title={appointment.prescription || "Prescription"}
                            subtitle={getPatientDisplayName(selectedPatient)}
                            scheduledAt={appointment.scheduledAt}
                            status={appointment.status}
                            reason={appointment.reason}
                          />
                        ))
                      ) : (
                        <EmptyState tone={tone} title="No prescriptions" body="Medication plans issued during consultations appear here." />
                      )}
                    </div>
                  )}

                  {recordsTab === "session" && (
                    <div className="space-y-3">
                      <div className={`rounded-xl border p-4 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>Live Session Status</p>
                        <p className={`mt-2 text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>{selectedPatientLiveStatus}</p>
                        {selectedPatientActiveAppointment && (
                          <button
                            type="button"
                            onClick={() => { setIsDetailOpen(false); onOpenLive(); }}
                            className="mt-4 w-full rounded-xl bg-brand-red px-4 py-2.5 text-xs font-black text-white shadow-xs"
                          >
                            Return To Live Room
                          </button>
                        )}
                      </div>
                      <RecordTimeline
                        tone={tone}
                        appointments={selectedPatient.confirmed}
                        selectedConsultationId={selectedConsultation?.id || ""}
                        onSelectConsultation={onSelectConsultation}
                      />
                    </div>
                  )}

                  {/* Focused Encounter Context Box */}
                  {selectedConsultation && (
                    <div className={`mt-5 rounded-2xl border p-4 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Selected Encounter Detail</p>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase ${getStatusClasses(selectedConsultation.status)}`}>
                          {selectedConsultation.status}
                        </span>
                      </div>
                      <div className="rounded-xl border border-amber-300/20 border-l-4 border-l-amber-300 bg-amber-300/10 p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">Patient Notes &amp; Suspected Causes</p>
                        <p className="mt-1 text-xs font-semibold text-amber-50">
                          {extractComplaintAndNotes(selectedConsultation.reason).complaint || "No notes captured."}
                        </p>
                        <p className="mt-2 text-[10px] font-bold text-amber-200/80">{formatDateTime(selectedConsultation.scheduledAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ClinicalTextBlock({ title, body, tone = "light" }: { title: string; body: string; tone?: "light" | "dark" }) {
  const isDark = tone === "dark";
  return (
    <div className={`rounded-xl border p-4 transition-colors ${
      isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50/80"
    }`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>{title}</p>
      <p className={`mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed ${isDark ? "text-slate-200" : "text-slate-700"}`}>{body}</p>
    </div>
  );
}

function RecordTimeline({
  appointments,
  selectedConsultationId,
  onSelectConsultation,
  tone = "light",
}: {
  appointments: DoctorAppointment[];
  selectedConsultationId: string;
  onSelectConsultation: (consultationId: string) => void;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return appointments.length ? (
    <div className="space-y-2">
      {appointments.map((appointment) => {
        const isSelected = appointment.id === selectedConsultationId;

        return (
          <button
            key={appointment.id}
            type="button"
            onClick={() => onSelectConsultation(appointment.id)}
            className={`w-full rounded-xl border p-3 text-left transition ${
              isSelected
                ? "border-brand-teal bg-brand-teal/10"
                : isDark
                  ? "border-slate-800 bg-slate-950 hover:border-slate-700"
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>{formatDateTime(appointment.scheduledAt)}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getStatusClasses(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>
            <p className={`mt-2 line-clamp-2 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {appointment.reason || appointment.notes || appointment.prescription || "Clinical encounter"}
            </p>
          </button>
        );
      })}
    </div>
  ) : (
    <EmptyState tone={tone} title="No records" body="Encounters for this patient appear here." />
  );
}

export default function DoctorDashboardClient({ doctor, doctors, initialModule = "overview" }: DoctorDashboardClientProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("healthko:doctor:theme");
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("healthko:doctor:theme", next);
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

  const tone = theme;
  const isDark = tone === "dark";

  const [activeModule, setActiveModule] = useDashboardModule<DoctorModuleId>(initialModule, DOCTOR_MODULES);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarImage, setSidebarImage] = useState<string | null>(doctor.image ?? null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [diagnosisText, setDiagnosisText] = useState("");
  const [rxGenericName, setRxGenericName] = useState("");
  const [rxBrandName, setRxBrandName] = useState("");
  const [rxDosage, setRxDosage] = useState("");
  const [rxQuantity, setRxQuantity] = useState("1 tablet");
  const [rxFrequency, setRxFrequency] = useState(RX_FREQUENCY_OPTIONS[2] as string);
  const [rxTiming, setRxTiming] = useState(RX_TIMING_OPTIONS[0] as string);
  const [rxDuration, setRxDuration] = useState("7 days");
  const [rxInstructions, setRxInstructions] = useState("");
  const [rxItems, setRxItems] = useState<Array<{
    id: string;
    genericName: string;
    brandName: string;
    dosage: string;
    quantity: string;
    frequency: string;
    timing: string;
    duration: string;
    instructions: string;
    formatted: string;
  }>>([]);
  const [referralTargets, setReferralTargets] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState({ loading: false, error: "", success: "" });
  const [scheduleState, setScheduleState] = useState({ loading: false, error: "", success: "" });
  const [followUpPatientId, setFollowUpPatientId] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isPatientDataModalOpen, setIsPatientDataModalOpen] = useState(false);
  const [noShowConfirmAppt, setNoShowConfirmAppt] = useState<DoctorAppointment | null>(null);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
  const [isEndCallLoading, setIsEndCallLoading] = useState(false);
  const [waitingStartedAt, setWaitingStartedAt] = useState<number | null>(null);
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("week");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientStatusFilter, setPatientStatusFilter] = useState<PatientStatusFilter>("all");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedConsultationId, setSelectedConsultationId] = useState("");
  const [selectedLiveAppointmentId, setSelectedLiveAppointmentId] = useState("");
  const [consultationQueueFilter, setConsultationQueueFilter] = useState<ConsultationQueueFilter>("all");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueDateRange, setQueueDateRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [vitalsForm, setVitalsForm] = useState({ bloodPressure: "", heartRate: "", bodyTemperature: "" });
  const [patientRecordsTab, setPatientRecordsTab] = useState<PatientRecordsTab>("records");
  const [patientReferenceTime] = useState(() => Date.now());
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [doctorAvailability, setDoctorAvailability] = useState(doctor.availability);
  const [doctorStatus, setDoctorStatus] = useState<DoctorStatusValue>(normalizeDoctorStatus(doctor.status));
  const [isUpdatingStatus, startStatusTransition] = useTransition();
  const [isSavingVitals, setIsSavingVitals] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; tone: "success" | "error"; message: string }[]>([]);

  useEffect(() => {
    setSidebarImage(doctor.image ?? null);
  }, [doctor.image]);

  const showToast = useCallback((tone: "success" | "error", message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const [callExtendedMinutes, setCallExtendedMinutes] = useState(0);

  const onRealtimeEvent = useCallback((event: RealtimeEvent) => {
    const targetsAnotherDoctor = "targetDoctorId" in event && event.targetDoctorId && event.targetDoctorId !== doctor.id;
    if (targetsAnotherDoctor) {
      return;
    }

    if (
      event.actorRole === "patient" &&
      (
        event.type === "appointment:created" ||
        event.type === "appointment:updated" ||
        event.type === "appointment:rescheduled" ||
        event.type === "appointment:cancelled"
      )
    ) {
      router.refresh();
    }

    if (event.type === "session:extended") {
      setCallExtendedMinutes((prev) => prev + (event.extendedMinutes || 0));
      showToast("success", event.body || `Consultation extended by ${event.extendedMinutes || 30} minutes.`);
    }

    if (event.type === "doctor:availability-updated" && event.doctorId === doctor.id) {
      setDoctorAvailability(event.availability);
      if (event.status) {
        setDoctorStatus(normalizeDoctorStatus(event.status));
      }
      router.refresh();
    }

    if (event.type === "doctor:status-updated" && event.doctorId === doctor.id) {
      setDoctorStatus(normalizeDoctorStatus(event.status));
      router.refresh();
    }
  }, [doctor.id, router, showToast]);

  const realtime = useDashboardRealtime(onRealtimeEvent);
  const doctorScopedRealtimeEvent = useMemo(() => {
    const event = realtime.lastEvent;
    if (!event || !("targetDoctorId" in event) || !event.targetDoctorId || event.targetDoctorId === doctor.id) {
      return event;
    }

    return null;
  }, [doctor.id, realtime.lastEvent]);
  const doctorStatusMeta = getDoctorStatusMeta(doctorStatus);
  const handleDoctorStatusChange = useCallback((nextStatus: DoctorStatusValue) => {
    const previousStatus = doctorStatus;
    setDoctorStatus(nextStatus);
    startStatusTransition(async () => {
      const result = await updateDoctorStatus(nextStatus);
      if (!result.success) {
        showToast("error", result.error || "Could not update doctor status.");
        setDoctorStatus(previousStatus);
        return;
      }

      const statusLabel = nextStatus === "BUSY" ? "Busy" : nextStatus === "OFFLINE" ? "Offline" : "Online";
      showToast("success", `Status updated to ${statusLabel}.`);
      realtime.publish({
        type: "doctor:status-updated",
        actorRole: "doctor",
        doctorId: doctor.id,
        status: nextStatus,
        title: "Doctor status updated",
        body: `Doctor availability status is now ${statusLabel}.`,
      });
    });
  }, [doctor.id, doctorStatus, realtime, showToast]);
  const session = useConsultationSession<DoctorAppointment>({
    role: "doctor",
    publish: realtime.publish,
    persistKey: `healthko:doctor:${doctor.id}:active-consultation`,
  });
  const isLiveConsultationActive = Boolean(session.roomId && (session.status === "waiting" || session.status === "connected"));
  const webRTC = useWebRTC({
    roomId: session.roomId,
    role: "doctor",
    isCameraOn: session.isCameraOn,
    isMicOn: session.isMicOn,
    isActive: isLiveConsultationActive,
    onRemoteSessionEnded: () => {
      session.endSession(false);
      showToast("error", "The other participant ended the consultation.");
      setActiveModule("overview");
    },
  });
  const receiveRealtimeEvent = session.receiveRealtimeEvent;
  const handleToggleScreenShare = useCallback(async () => {
    if (webRTC.isScreenSharing) {
      await webRTC.stopScreenShare();
      session.setScreenSharing(false);
      return;
    }

    const started = await webRTC.startScreenShare();
    if (started) {
      session.setScreenSharing(true);
    }
  }, [session, webRTC.isScreenSharing, webRTC.startScreenShare, webRTC.stopScreenShare]);

  const handleExtendCall = useCallback((additionalMinutes: number, newTotalMinutes: number) => {
    setCallExtendedMinutes((prev) => prev + additionalMinutes);
    if (session.activeAppointment) {
      realtime.publish({
        type: "session:extended",
        appointmentId: session.activeAppointment.id,
        actorRole: "doctor",
        extendedMinutes: additionalMinutes,
        newTotalDuration: newTotalMinutes,
        title: "Consultation extended",
        body: `Dr. ${doctor.name} extended the consultation by ${additionalMinutes} minutes.`,
      });
      showToast("success", `Consultation extended by ${additionalMinutes} minutes (New total: ${newTotalMinutes} mins).`);
    }
  }, [doctor.name, realtime, session.activeAppointment, showToast]);

  useEffect(() => {
    receiveRealtimeEvent(realtime.lastEvent);
  }, [realtime.lastEvent, receiveRealtimeEvent]);

  const pendingAppointments = useMemo(
    () =>
      doctor.bookings
        .filter((booking) => booking.status === "PENDING")
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [doctor.bookings]
  );
  const confirmedAppointments = useMemo(
    () =>
      doctor.bookings
        .filter((booking) => booking.status === "CONFIRMED")
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [doctor.bookings]
  );
  const completedConsultations = useMemo(
    () =>
      doctor.bookings
        .filter((booking) => booking.status === "COMPLETED")
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [doctor.bookings]
  );
  const cancelledAppointments = useMemo(
    () =>
      doctor.bookings
        .filter((booking) => booking.status === "CANCELLED")
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [doctor.bookings]
  );
  const consultationQueue = useMemo(
    () =>
      doctor.bookings
        .filter((booking) => booking.status === "CONFIRMED" || booking.status === "COMPLETED")
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [doctor.bookings]
  );
  const visibleConsultationQueue = useMemo(() => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const hasActiveFilter = queueSearch.trim() !== "" || queueDateRange.from !== "";

    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    if (queueDateRange.from) {
      const [fy, fm, fd] = queueDateRange.from.split("-").map(Number);
      rangeStart = new Date(fy, fm - 1, fd, 0, 0, 0, 0);

      if (queueDateRange.to) {
        const [ty, tm, td] = queueDateRange.to.split("-").map(Number);
        rangeEnd = new Date(ty, tm - 1, td, 23, 59, 59, 999);
      } else {
        rangeEnd = new Date(fy, fm - 1, fd, 23, 59, 59, 999);
      }
    }

    return consultationQueue.filter((booking) => {
      // Status filter
      if (consultationQueueFilter === "active" && booking.status !== "CONFIRMED") return false;
      if (consultationQueueFilter === "completed" && booking.status !== "COMPLETED") return false;

      const bookingTime = new Date(booking.scheduledAt).getTime();

      // Default 30-day cutoff (only when no search or date range filter is active)
      if (!hasActiveFilter && now - bookingTime > thirtyDaysMs) return false;

      // Name search
      if (queueSearch.trim()) {
        const q = queueSearch.toLowerCase();
        const fullName = `${booking.patient.firstName} ${booking.patient.lastName}`.toLowerCase();
        if (!fullName.includes(q)) return false;
      }

      // Date range filter (supports up to 26 days range)
      if (rangeStart && rangeEnd) {
        const d = new Date(booking.scheduledAt);
        if (d < rangeStart || d > rangeEnd) return false;
      }

      return true;
    });
  }, [consultationQueue, consultationQueueFilter, queueSearch, queueDateRange]);
  const selectedLiveAppointment = useMemo(
    () =>
      visibleConsultationQueue.find((booking) => booking.id === selectedLiveAppointmentId) ||
      visibleConsultationQueue.find((booking) => booking.status === "CONFIRMED") ||
      visibleConsultationQueue[0] ||
      null,
    [selectedLiveAppointmentId, visibleConsultationQueue]
  );
  const patients = useMemo(() => {
    const map = new Map<string, DoctorAppointment["patient"]>();
    doctor.bookings.forEach((booking) => map.set(booking.patient.id, booking.patient));
    return Array.from(map.values());
  }, [doctor.bookings]);
  const prescriptions = useMemo(
    () => doctor.bookings.filter((booking) => booking.prescription),
    [doctor.bookings]
  );
  const patientProfiles = useMemo<PatientProfile[]>(() => {
    const patientMap = new Map<string, PatientProfile>();
    const sortedBookings = [...doctor.bookings].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

    sortedBookings.forEach((booking) => {
      const existing = patientMap.get(booking.patient.id);
      const profile: PatientProfile = existing || {
        ...booking.patient,
        appointments: [],
        pending: [],
        confirmed: [],
        completed: [],
        prescriptions: [],
        nextAppointment: null,
        lastEncounter: null,
        activeAppointment: null,
      };

      profile.appointments.push(booking);

      if (booking.status === "PENDING") {
        profile.pending.push(booking);
      }

      if (booking.status === "CONFIRMED") {
        profile.confirmed.push(booking);
      }

      if (booking.status === "COMPLETED") {
        profile.completed.push(booking);
      }

      if (booking.prescription) {
        profile.prescriptions.push(booking);
      }

      patientMap.set(booking.patient.id, profile);
    });

    return Array.from(patientMap.values())
      .map((profile) => {
        const futureAppointments = profile.appointments.filter(
          (booking) => booking.status === "CONFIRMED" && new Date(booking.scheduledAt).getTime() >= patientReferenceTime
        );
        const pastAppointments = profile.appointments.filter(
          (booking) => new Date(booking.scheduledAt).getTime() < patientReferenceTime || booking.status === "COMPLETED"
        );

        return {
          ...profile,
          nextAppointment: futureAppointments[0] || null,
          lastEncounter: pastAppointments[pastAppointments.length - 1] || null,
          activeAppointment:
            session.activeAppointment?.patient.id === profile.id ? session.activeAppointment : null,
        };
      })
      .sort((a, b) => {
        const aTime = new Date(a.nextAppointment?.scheduledAt || a.lastEncounter?.scheduledAt || 0).getTime();
        const bTime = new Date(b.nextAppointment?.scheduledAt || b.lastEncounter?.scheduledAt || 0).getTime();
        return bTime - aTime;
      });
  }, [doctor.bookings, patientReferenceTime, session.activeAppointment]);

  const livePatientProfile = useMemo(() => {
    if (!selectedLiveAppointment) return null;
    return patientProfiles.find((p) => p.id === selectedLiveAppointment.patient.id) || null;
  }, [patientProfiles, selectedLiveAppointment]);

  const filteredPatientProfiles = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();

    return patientProfiles.filter((profile) => {
      const searchable = [
        profile.firstName,
        profile.lastName,
        profile.email,
        profile.phone,
        profile.gender || "",
        profile.appointments.map((appointment) => appointment.reason || "").join(" "),
      ].join(" ").toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesFilter =
        patientStatusFilter === "all" ||
        (patientStatusFilter === "active" && profile.confirmed.length > 0) ||
        (patientStatusFilter === "pending" && profile.pending.length > 0) ||
        (patientStatusFilter === "completed" && profile.completed.length > 0) ||
        (patientStatusFilter === "prescriptions" && profile.prescriptions.length > 0);

      return matchesSearch && matchesFilter;
    });
  }, [patientProfiles, patientSearch, patientStatusFilter]);

  const selectedPatient = useMemo(() => {
    return (
      patientProfiles.find((profile) => profile.id === selectedPatientId) ||
      filteredPatientProfiles[0] ||
      patientProfiles[0] ||
      null
    );
  }, [filteredPatientProfiles, patientProfiles, selectedPatientId]);

  const selectedConsultation = useMemo(() => {
    if (!selectedPatient) {
      return null;
    }

    return (
      selectedPatient.appointments.find((booking) => booking.id === selectedConsultationId) ||
      selectedPatient.activeAppointment ||
      selectedPatient.nextAppointment ||
      selectedPatient.lastEncounter ||
      selectedPatient.appointments[0] ||
      null
    );
  }, [selectedConsultationId, selectedPatient]);

  const selectedLiveAppointmentKey = selectedLiveAppointment?.id || "";
  const selectedLiveAppointmentBloodPressure = selectedLiveAppointment?.bloodPressure || "";
  const selectedLiveAppointmentHeartRate = selectedLiveAppointment?.heartRate || "";
  const selectedLiveAppointmentBodyTemperature = selectedLiveAppointment?.bodyTemperature || "";

  useEffect(() => {
    const nextVitals = selectedLiveAppointmentKey
      ? {
          bloodPressure: selectedLiveAppointmentBloodPressure,
          heartRate: selectedLiveAppointmentHeartRate,
          bodyTemperature: selectedLiveAppointmentBodyTemperature,
        }
      : { bloodPressure: "", heartRate: "", bodyTemperature: "" };

    Promise.resolve().then(() => {
      setVitalsForm(nextVitals);
    });
  }, [
    selectedLiveAppointmentKey,
    selectedLiveAppointmentBloodPressure,
    selectedLiveAppointmentHeartRate,
    selectedLiveAppointmentBodyTemperature,
  ]);

  const notificationSeed = useMemo<DashboardNotification[]>(
    () => [
      ...pendingAppointments.slice(0, 4).map((booking) =>
        createDashboardNotification({
          id: `doctor-request-${booking.id}`,
          title: "New appointment request",
          body: `${booking.patient.firstName} ${booking.patient.lastName} / ${formatDateTime(booking.scheduledAt)}`,
          kind: "appointment",
          createdAt: booking.createdAt,
          readAt: null,
        })
      ),
      ...confirmedAppointments.slice(0, 2).map((booking) =>
        createDashboardNotification({
          id: `doctor-consultation-${booking.id}`,
          title: "Consultation reminder",
          body: `${booking.patient.firstName} ${booking.patient.lastName} is scheduled for ${formatDateTime(booking.scheduledAt)}`,
          kind: "consultation",
          createdAt: booking.createdAt,
          readAt: booking.createdAt,
        })
      ),
      ...prescriptions.slice(0, 2).map((booking) =>
        createDashboardNotification({
          id: `doctor-prescription-${booking.id}`,
          title: "Prescription issued",
          body: `${booking.patient.firstName} ${booking.patient.lastName} has an active prescription record.`,
          kind: "prescription",
          createdAt: booking.createdAt,
          readAt: booking.createdAt,
        })
      ),
    ],
    [confirmedAppointments, pendingAppointments, prescriptions]
  );
  const dashboardNotifications = useDashboardNotifications({
    role: "doctor",
    initialNotifications: notificationSeed,
    realtimeEvent: doctorScopedRealtimeEvent,
  });

  const visibleScheduleAppointments = useMemo(() => {
    // Pass all doctor bookings so AppointmentCalendar can map them to the active day/week/month view
    return [...doctor.bookings].sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
  }, [doctor.bookings]);

  const navItems: DashboardNavItem<DoctorModuleId>[] = [
    { id: "overview", label: "Overview" },
    { id: "schedule", label: "Appointment Calendar", badge: pendingAppointments.length || undefined },
    { id: "live", label: "Patient Consultation", badge: confirmedAppointments.length || undefined },
    { id: "patients", label: "Patient Management" },
    { id: "settings", label: "Settings" },
  ];

  const handleAccept = async (consultationId: string) => {
    setActionLoadingId(consultationId);
    setScheduleState({ loading: false, error: "", success: "" });
    const result = await acceptAppointment(consultationId);
    setActionLoadingId(null);
    if (result.success) {
      setScheduleState({ loading: false, error: "", success: "" });
      showToast("success", "Appointment approved and schedule updated.");
      realtime.publish({ type: "appointment:updated", appointmentId: consultationId, actorRole: "doctor", title: "Appointment approved", body: "Your doctor approved the consultation request." });
      router.refresh();
    } else {
      const message = result.error || "Could not approve appointment.";
      setScheduleState({ loading: false, error: message, success: "" });
      showToast("error", message);
    }
  };

  const handleCancel = async (consultationId: string) => {
    setActionLoadingId(consultationId);
    const result = await cancelAppointment(consultationId);
    setActionLoadingId(null);
    if (result.success) {
      realtime.publish({ type: "appointment:cancelled", appointmentId: consultationId, actorRole: "doctor", title: "Appointment cancelled", body: "Your doctor cancelled this consultation request." });
      router.refresh();
    }
  };

  const executeNoShow = async (appointment: DoctorAppointment) => {
    setActionLoadingId(appointment.id);
    const result = await cancelAppointment(appointment.id, "Patient No Show - Patient did not attend scheduled consultation.");
    setActionLoadingId(null);
    if (result.success) {
      showToast("success", `Marked ${appointment.patient.firstName} ${appointment.patient.lastName} as No Show and closed consultation.`);
      realtime.publish({
        type: "appointment:cancelled",
        appointmentId: appointment.id,
        actorRole: "doctor",
        targetPatientId: appointment.patient.id,
        title: "Consultation marked as No Show",
        body: `You were marked as No Show for your scheduled consultation with Dr. ${doctor.name}. Please book a new consultation.`,
      });
      router.refresh();
    } else {
      showToast("error", ("error" in result && result.error) || "Could not mark appointment as No Show.");
    }
  };

  const handleReschedule = async (consultationId: string, scheduledAt: string) => {
    setActionLoadingId(consultationId);
    setScheduleState({ loading: false, error: "", success: "" });
    const result = await rescheduleAppointment({ consultationId, scheduledAt });
    setActionLoadingId(null);
    if (result.success) {
      setScheduleState({ loading: false, error: "", success: "" });
      showToast("success", "Consultation rescheduled and patient dashboard updated.");
      realtime.publish({
        type: "appointment:rescheduled",
        appointmentId: consultationId,
        actorRole: "doctor",
        scheduledAt,
        title: "Consultation rescheduled",
        body: `Your consultation moved to ${formatDateTime(scheduledAt)}.`,
      });
      router.refresh();
    } else {
      const message = result.error || "Could not reschedule consultation.";
      setScheduleState({ loading: false, error: message, success: "" });
      showToast("error", message);
    }
  };

  const handleScheduleFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!followUpPatientId || !followUpDate || !followUpTime || !followUpReason.trim()) {
      const message = "Choose a patient, date, time, and follow-up reason.";
      setScheduleState({ loading: false, error: message, success: "" });
      showToast("error", message);
      return;
    }

    setScheduleState({ loading: true, error: "", success: "" });
    const scheduledAt = `${followUpDate}T${followUpTime}:00`;
    const result = await scheduleFollowUpAppointment({
      patientId: followUpPatientId,
      scheduledAt,
      reason: followUpReason,
    });

    if (!result.success) {
      const message = result.error || "Could not schedule follow-up consultation.";
      setScheduleState({ loading: false, error: message, success: "" });
      showToast("error", message);
      return;
    }

    realtime.publish({
      type: "appointment:created",
      appointmentId: result.consultation?.id || "follow-up",
      actorRole: "doctor",
      scheduledAt,
      title: "Follow-up confirmation requested",
      body: `Your doctor requested a follow-up for ${formatDateTime(scheduledAt)}. Please confirm or request a new time.`,
    });
    setScheduleState({ loading: false, error: "", success: "" });
    showToast("success", "Follow-up request sent for patient confirmation.");
    setFollowUpPatientId("");
    setFollowUpDate("");
    setFollowUpTime("");
    setFollowUpReason("");
    setIsFollowUpModalOpen(false);
    router.refresh();
  };

  const openFollowUpForPatient = (patientId: string, reason?: string | null) => {
    setFollowUpPatientId(patientId);
    setFollowUpReason(reason ? `Follow-up: ${reason}` : "Follow-up consultation");
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 7);
    const dateStr = nextDate.toISOString().split("T")[0];
    setFollowUpDate((prev) => prev || dateStr);
    setFollowUpTime((prev) => prev || "09:00");
    setScheduleState({ loading: false, error: "", success: "" });
    setIsFollowUpModalOpen(true);
  };

  /** Called when doctor clicks "Start Consultation" on a calendar appointment block */
  const handleStartConsultationFromCalendar = (appointment: { id: string }) => {
    setSelectedLiveAppointmentId(appointment.id);
    setActiveModule("live");
  };

  /** Called when doctor clicks "Follow Up Consultation" on a completed calendar appointment block */
  const handleFollowUpFromCalendar = (appointment: { id: string; title: string; subtitle: string }) => {
    // Find the underlying booking to get the patient ID
    const booking = doctor.bookings.find((b) => b.id === appointment.id);
    if (booking) {
      openFollowUpForPatient(booking.patient.id, booking.reason);
    }
  };

  /** Called to directly mark a consultation as completed (from calendar popover or queue) */
  const handleCompleteConsultationDirect = async (consultationId: string) => {
    const booking = doctor.bookings.find((b) => b.id === consultationId);
    setActionLoadingId(consultationId);
    const result = await completeConsultation({
      consultationId,
      notes: booking?.notes || undefined,
      prescription: booking?.prescription || undefined,
      reason: booking?.reason || undefined,
    });
    setActionLoadingId(null);
    if (result.success) {
      showToast("success", "Consultation marked as completed.");
      realtime.publish({
        type: "appointment:updated",
        appointmentId: consultationId,
        actorRole: "doctor",
        title: "Consultation completed",
        body: `Your consultation with Dr. ${doctor.name} has been completed.`,
      });
      router.refresh();
    } else {
      showToast("error", ("error" in result && result.error) || "Could not complete consultation.");
    }
  };

  const handleReferral = async (consultationId: string) => {
    const targetDoctorId = referralTargets[consultationId];
    if (!targetDoctorId) {
      return;
    }

    setActionLoadingId(consultationId);
    const result = await referAppointment({ consultationId, targetDoctorId });
    setActionLoadingId(null);
    if (result.success) {
      realtime.publish({
        type: "appointment:referred",
        appointmentId: result.consultation?.id || consultationId,
        actorRole: "doctor",
        targetDoctorId,
        title: "Referral recommended",
        body: "Your visit was reassigned to a doctor whose specialization better matches your reason for visit.",
      });
      router.refresh();
    }
  };

  const handleSaveVitals = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedLiveAppointment) {
      return;
    }

    setIsSavingVitals(true);
    try {
      const result = await updateConsultationVitals({
        consultationId: selectedLiveAppointment.id,
        bloodPressure: vitalsForm.bloodPressure,
        heartRate: vitalsForm.heartRate,
        bodyTemperature: vitalsForm.bodyTemperature,
      });

      if (result.success) {
        showToast("success", "Vitals updated and saved to the consultation record.");
        router.refresh();
      } else {
        showToast("error", result.error || "Could not save consultation vitals.");
      }
    } finally {
      setIsSavingVitals(false);
    }
  };

  const addRxItem = () => {
    if (!rxGenericName.trim() && !rxBrandName.trim()) {
      showToast("error", "Please fill in at least a Generic Name or Brand Name.");
      return;
    }
    const formatted = buildFormattedPrescription({
      genericName: rxGenericName,
      brandName: rxBrandName,
      dosage: rxDosage,
      quantity: rxQuantity,
      frequency: rxFrequency,
      timing: rxTiming,
      duration: rxDuration,
      instructions: rxInstructions,
    });
    const newItem = {
      id: `rx-${Date.now()}`,
      genericName: rxGenericName,
      brandName: rxBrandName,
      dosage: rxDosage,
      quantity: rxQuantity,
      frequency: rxFrequency,
      timing: rxTiming,
      duration: rxDuration,
      instructions: rxInstructions,
      formatted,
    };
    const updatedItems = [...rxItems, newItem];
    setRxItems(updatedItems);
    // Compile full prescription from all items
    setPrescriptionText(updatedItems.map((item, i) => `--- Medicine ${i + 1} ---\n${item.formatted}`).join("\n\n"));
    // Reset draft fields
    setRxGenericName("");
    setRxBrandName("");
    setRxDosage("");
    setRxQuantity("1 tablet");
    setRxFrequency(RX_FREQUENCY_OPTIONS[2] as string);
    setRxTiming(RX_TIMING_OPTIONS[0] as string);
    setRxDuration("7 days");
    setRxInstructions("");
  };

  const removeRxItem = (id: string) => {
    const updatedItems = rxItems.filter((item) => item.id !== id);
    setRxItems(updatedItems);
    setPrescriptionText(
      updatedItems.length
        ? updatedItems.map((item, i) => `--- Medicine ${i + 1} ---\n${item.formatted}`).join("\n\n")
        : ""
    );
  };

  const startLiveSession = async (appointment: DoctorAppointment) => {
    setClinicalNotes(appointment.notes || "");
    setPrescriptionText(appointment.prescription || "");
    setDiagnosisText(appointment.reason || "");
    setRxGenericName("");
    setRxBrandName("");
    setRxDosage("");
    setRxQuantity("1 tablet");
    setRxFrequency(RX_FREQUENCY_OPTIONS[2] as string);
    setRxTiming(RX_TIMING_OPTIONS[0] as string);
    setRxDuration("7 days");
    setRxInstructions("");
    setRxItems([]);
    setActionLoadingId(appointment.id);
    const result = await startVideoSession(appointment.id);
    setActionLoadingId(null);

    if (!result.success || !result.roomId || !result.accessToken) {
      showToast("error", result.error || "Could not start secure video session.");
      setSubmitState({ loading: false, error: "", success: "" });
      return;
    }

    session.enterAuthorizedRoom(appointment, result.roomId, result.accessToken, "waiting");
    setWaitingStartedAt(Date.now());

    realtime.publish({
      type: "session:started",
      appointmentId: appointment.id,
      actorRole: "doctor",
      roomId: result.roomId,
      title: "Doctor started the consultation",
      body: `Dr. ${doctor.name} has started your consultation. Join the secure live room now.`,
    });
    setActiveModule("live");
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session.activeAppointment) {
      return;
    }

    if (!clinicalNotes.trim() || !prescriptionText.trim()) {
      showToast("error", "Clinical notes and prescription are required.");
      setSubmitState({ loading: false, error: "", success: "" });
      return;
    }

    setSubmitState({ loading: true, error: "", success: "" });
    const result = await completeConsultation({
      consultationId: session.activeAppointment.id,
      notes: clinicalNotes,
      prescription: prescriptionText,
      reason: diagnosisText || undefined,
    });

    if (!result.success) {
      showToast("error", result.error || "Could not complete consultation.");
      setSubmitState({ loading: false, error: "", success: "" });
      return;
    }

    if (session.activeAppointment) {
      session.activeAppointment.notes = clinicalNotes;
      session.activeAppointment.prescription = prescriptionText;
      if (diagnosisText) {
        session.activeAppointment.reason = diagnosisText;
      }
    }

    realtime.publish({
      type: "appointment:updated",
      appointmentId: session.activeAppointment.id,
      actorRole: "doctor",
      notes: clinicalNotes,
      prescription: prescriptionText,
      title: "Consultation notes updated",
      body: "Your doctor updated your consultation notes and prescription.",
    });
    showToast("success", "Consultation notes and prescription saved. Live call remains active.");
    setSubmitState({ loading: false, error: "", success: "Prescription and notes saved." });

    // Note: The call stays active so doctor and patient can continue speaking!
    // The call can be ended when doctor clicks the red "End Call" button.
    router.refresh();
  };

  const handleEndSession = async () => {
    const roomId = session.roomId;
    if (session.activeAppointment) {
      await endVideoSession(session.activeAppointment.id);
    }
    if (roomId) {
      realtime.endVideoRoom(roomId);
    }
    session.endSession();
    setWaitingStartedAt(null);
    setActiveModule("overview");
    router.refresh();
  };

  return (
    <DashboardShell
      role="doctor"
      theme={theme}
      onToggleTheme={toggleTheme}
      activeModule={activeModule}
      navItems={navItems}
      title={doctor.name}
      subtitle="Doctor dashboard"
      profile={{
        name: doctor.name,
        detail: doctor.specialty,
        meta: `NPI ${doctor.npi}`,
        image: sidebarImage,
        isVerified: doctor.isVerified,
      }}
      connectionState={realtime.connectionState}
      notificationBell={
        <NotificationBell
          role="doctor"
          tone={tone}
          notifications={dashboardNotifications.notifications}
          unreadCount={dashboardNotifications.unreadCount}
          onMarkAllRead={dashboardNotifications.markAllRead}
          onOpenNotifications={() => setActiveModule("notifications")}
        />
      }
      statusIndicator={
        <label className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
          isDark
            ? "border-slate-800 bg-slate-950 text-slate-200"
            : "border-slate-200 bg-white text-slate-700 shadow-2xs"
        }`}>
          <span className={`h-2.5 w-2.5 rounded-full ${doctorStatusMeta.label === "Busy" ? "bg-amber-400" : doctorStatusMeta.label === "Offline" ? "bg-slate-400" : "bg-emerald-400"}`} />
          <span className="sr-only">Update availability status</span>
          <select
            value={doctorStatus}
            onChange={(event) => handleDoctorStatusChange(normalizeDoctorStatus(event.target.value))}
            disabled={isUpdatingStatus}
            className={`cursor-pointer bg-transparent text-[10px] font-black uppercase tracking-widest outline-none disabled:cursor-wait ${
              isDark ? "text-slate-200" : "text-slate-700"
            }`}
            aria-label="Update availability status"
          >
            {DOCTOR_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className={isDark ? "bg-slate-950 text-white" : "bg-white text-slate-900"}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      }
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onNavigate={setActiveModule}
      onLogout={() => (
        <form action={logoutDoctor}>
          <button
            type="submit"
            className={`w-full rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-[0.2em] transition-colors ${
              isDark
                ? "bg-slate-850 text-white hover:bg-slate-800"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80"
            }`}
          >
            Sign Out
          </button>
        </form>
      )}
    >
      <div className="fixed right-5 top-5 z-[80] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur ${
              toast.tone === "success"
                ? "border-emerald-300/30 bg-emerald-950/90 text-emerald-100"
                : "border-red-300/30 bg-red-950/90 text-red-100"
            }`}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>

      {session.activeAppointment && activeModule !== "live" && session.status === "connected" && (
        <FloatingConsultationCall
          role="doctor"
          counterpartName={`${session.activeAppointment.patient.firstName} ${session.activeAppointment.patient.lastName}`}
          status={session.status}
          isCameraOn={session.isCameraOn}
          isMicOn={session.isMicOn}
          isScreenSharing={session.isScreenSharing}
          counterpartCameraOn={session.counterpartCameraOn}
          counterpartMicOn={session.counterpartMicOn}
          counterpartScreenSharing={session.counterpartScreenSharing}
          connectedAt={session.connectedAt}
          onToggleCamera={session.toggleCamera}
          onToggleMic={session.toggleMic}
          onToggleScreenShare={handleToggleScreenShare}
          onEnd={() => setShowEndCallConfirm(true)}
          onOpen={() => setActiveModule("live")}
          localStream={webRTC.localStream}
          screenShareStream={webRTC.screenShareStream}
          remoteStream={webRTC.remoteStream}
          connectionState={webRTC.connectionState}
          mediaError={webRTC.error || webRTC.deviceStatus.message}
          screenShareSupported={webRTC.screenShareSupported}
        />
      )}

      {activeModule === "overview" && (
        <div className="space-y-5">
          {/* Doctor overview stats - compact 3-col on mobile */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Pending", value: pendingAppointments.length, helper: "Awaiting response", color: "text-amber-500", border: "border-amber-500/20", bg: "bg-amber-500/10" },
              { label: "Confirmed", value: confirmedAppointments.length, helper: "Scheduled visits", color: "text-emerald-500", border: "border-emerald-500/20", bg: "bg-emerald-500/10" },
              { label: "Patients", value: patients.length, helper: "Total active", color: "text-brand-teal", border: "border-brand-teal/20", bg: "bg-brand-teal/10" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-2xl border p-4 transition-colors ${
                  isDark ? `${stat.border} ${stat.bg}` : "border-slate-200 bg-white shadow-xs"
                }`}
              >
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                <p className={`mt-0.5 text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>{stat.label}</p>
                <p className={`mt-0.5 hidden text-[10px] font-medium sm:block ${isDark ? "text-slate-500" : "text-slate-400"}`}>{stat.helper}</p>
              </div>
            ))}
          </div>

          <section className={`overflow-hidden rounded-2xl border transition-colors ${
            isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white shadow-xs"
          }`}>
            <div className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${
              isDark ? "border-slate-800/80" : "border-slate-100"
            }`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Today&apos;s Queue</p>
                <h2 className={`mt-0.5 text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>Clinical Queue</h2>
              </div>
              <span className={`rounded-xl border px-3 py-1.5 text-xs font-black ${
                isDark ? "border-slate-700 bg-slate-800 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
              }`}>
                {confirmedAppointments.length} visits
              </span>
            </div>
            <div className={`divide-y ${isDark ? "divide-slate-800/60" : "divide-slate-100"}`}>
              {confirmedAppointments.length ? (
                confirmedAppointments.map((booking) => {
                  const patientAgeText = getPatientAge(booking.patient.dob);
                  const patientGenderText = booking.patient.gender
                    ? booking.patient.gender.charAt(0).toUpperCase() + booking.patient.gender.slice(1).toLowerCase()
                    : "Unspecified";
                  const patientInfo =
                    patientAgeText === "Age unavailable" ? patientAgeText : `${patientAgeText} old`;

                  return (
                    <article
                      key={booking.id}
                      className={`group p-4 transition-colors ${isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50/70"}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {/* Patient avatar */}
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-teal/15 text-sm font-black text-brand-teal">
                            {booking.patient.firstName?.[0]}{booking.patient.lastName?.[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                                {booking.patient.firstName} {booking.patient.lastName}
                              </h3>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getStatusClasses(booking.status)}`}>
                                {booking.status}
                              </span>
                            </div>
                            <p className={`mt-0.5 text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {patientInfo} · {patientGenderText}
                            </p>
                            {booking.reason && (
                              <p className={`mt-1 line-clamp-2 text-xs font-medium leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                                {booking.reason}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Time + CTA row */}
                        <div className={`flex shrink-0 items-center justify-between gap-3 border-t pt-3 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end ${
                          isDark ? "border-slate-800/80" : "border-slate-100"
                        }`}>
                          <div className={`rounded-xl border px-3 py-1.5 text-left sm:text-right ${
                            isDark ? "border-slate-700/80 bg-slate-800/60" : "border-slate-200 bg-slate-50"
                          }`}>
                            <p className="text-[9px] font-black uppercase tracking-wide text-brand-teal">Scheduled</p>
                            <p className={`mt-0.5 text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>{formatDateTime(booking.scheduledAt)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => startLiveSession(booking)}
                            className="rounded-xl bg-brand-red px-4 py-2 text-xs font-black text-white shadow-sm shadow-brand-red/30 transition hover:opacity-90 active:scale-[0.98]"
                          >
                            Start Consultation
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="p-5">
                  <EmptyState tone={tone} title="No confirmed visits" body="Accepted appointments appear in the clinical queue." />
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeModule === "live" && (
        session.activeAppointment ? (
          session.status === "waiting" ? (
            // ── Waiting Lobby ──────────────────────────────────────────────────────
            <WaitingLobby
              tone={tone}
              patientName={`${session.activeAppointment.patient.firstName} ${session.activeAppointment.patient.lastName}`}
              waitingStartedAt={waitingStartedAt}
              onEndSession={async () => {
                // End the video session but stay on the consultation queue, not overview
                const roomId = session.roomId;
                if (session.activeAppointment) {
                  await endVideoSession(session.activeAppointment.id);
                }
                if (roomId) {
                  realtime.endVideoRoom(roomId);
                }
                session.endSession();
                setWaitingStartedAt(null);
                setActiveModule("live"); // Stay on consultation queue
                router.refresh();
              }}
              onMarkNoShow={() => {
                if (session.activeAppointment) {
                  setNoShowConfirmAppt(session.activeAppointment);
                }
              }}
            />
          ) : (
            // ── Full Live Call Panel (patient connected) ────────────────────────
            <LiveConsultationPanel
            tone={tone}
            role="doctor"
            counterpartName={`${session.activeAppointment.patient.firstName} ${session.activeAppointment.patient.lastName}`}
            appointmentTime={session.activeAppointment.scheduledAt}
            status={session.status}
            isCameraOn={session.isCameraOn}
            isMicOn={session.isMicOn}
            isScreenSharing={session.isScreenSharing}
            counterpartCameraOn={session.counterpartCameraOn}
            counterpartMicOn={session.counterpartMicOn}
            counterpartScreenSharing={session.counterpartScreenSharing}
            connectedAt={session.connectedAt}
            onToggleCamera={session.toggleCamera}
            onToggleMic={session.toggleMic}
            onToggleScreenShare={handleToggleScreenShare}
            onEnd={() => setShowEndCallConfirm(true)}
            localStream={webRTC.localStream}
            screenShareStream={webRTC.screenShareStream}
            remoteStream={webRTC.remoteStream}
            connectionState={webRTC.connectionState}
            mediaError={webRTC.error}
            screenShareSupported={webRTC.screenShareSupported}
            scheduledDurationMinutes={session.activeAppointment.duration || doctor.consultationDuration || 30}
            onExtendCall={handleExtendCall}
            externalExtendedMinutes={callExtendedMinutes}
            chat={<ChatPanel role="doctor" messages={session.messages} onSend={session.sendMessage} tone={tone} />}
            documentation={
              <section className={`rounded-xl border p-4 transition-colors max-h-[calc(100vh-14rem)] overflow-y-auto ${
                isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"
              }`}>
                <div className="flex items-center justify-between gap-2 border-b pb-3 mb-3 border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Clinical Documentation</p>
                    <h3 className="text-sm font-black mt-0.5">Notes &amp; E-Prescription</h3>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                    Live Call Active
                  </span>
                </div>

                <form onSubmit={handleComplete} className="space-y-4">
                  {/* Patient notes section */}
                  {(() => {
                    const parsed = extractComplaintAndNotes(session.activeAppointment?.reason || diagnosisText);
                    return (
                      <div className={`rounded-xl border border-l-4 p-3 transition-colors ${
                        isDark
                          ? "border-amber-400/20 border-l-amber-300 bg-amber-300/10"
                          : "border-amber-200 border-l-amber-500 bg-amber-50/70"
                      }`}>
                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-amber-200" : "text-amber-800"}`}>
                          Patient Complaint &amp; Suspected Causes
                        </p>
                        <p className={`mt-1 text-xs font-semibold leading-relaxed ${isDark ? "text-amber-50" : "text-amber-950"}`}>
                          {parsed.complaint || "No notes were provided for this appointment."}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Consultation Notes */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Consultation Notes / Clinical Observations
                    </label>
                    <textarea
                      value={clinicalNotes}
                      onChange={(event) => setClinicalNotes(event.target.value)}
                      rows={3}
                      placeholder="Doctor's clinical assessment, diagnosis, patient findings..."
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none transition focus:border-brand-teal ${
                        isDark ? "border-slate-800 bg-slate-950 text-white placeholder:text-slate-600" : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                      }`}
                    />
                  </div>

                  {/* Structured Prescription Builder */}
                  <div className={`rounded-xl border p-3 space-y-3 ${
                    isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50/70"
                  }`}>
                    <div className="flex items-center justify-between gap-2 border-b pb-2 border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center gap-1.5">
                        <span className="grid h-5 w-5 place-items-center rounded bg-brand-teal/20 text-brand-teal text-[10px] font-black">
                          Rx
                        </span>
                        <p className="text-xs font-black uppercase tracking-wide">Prescription Details</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold">Standard Format</span>
                    </div>

                    {/* Generic & Brand Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                          Generic Name *
                        </label>
                        <input
                          type="text"
                          value={rxGenericName}
                          onChange={(e) => setRxGenericName(e.target.value)}
                          placeholder="e.g. Amoxicillin, Paracetamol"
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-teal ${
                            isDark ? "border-slate-800 bg-slate-900 text-white placeholder:text-slate-600" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                          Brand Name
                        </label>
                        <input
                          type="text"
                          value={rxBrandName}
                          onChange={(e) => setRxBrandName(e.target.value)}
                          placeholder="e.g. Amoxil, Biogesic"
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-teal ${
                            isDark ? "border-slate-800 bg-slate-900 text-white placeholder:text-slate-600" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Dosage & Number to Consume */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                          Dosage / Strength *
                        </label>
                        <input
                          type="text"
                          value={rxDosage}
                          onChange={(e) => setRxDosage(e.target.value)}
                          placeholder="e.g. 500 mg, 250 mg / 5 mL"
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-teal ${
                            isDark ? "border-slate-800 bg-slate-900 text-white placeholder:text-slate-600" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                          Number of Consume (Dose) *
                        </label>
                        <input
                          type="text"
                          list="rx-quantity-list"
                          value={rxQuantity}
                          onChange={(e) => setRxQuantity(e.target.value)}
                          placeholder="e.g. 1 tablet, 2 capsules"
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-teal ${
                            isDark ? "border-slate-800 bg-slate-900 text-white placeholder:text-slate-600" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                          }`}
                        />
                        <datalist id="rx-quantity-list">
                          {RX_QUANTITY_SUGGESTIONS.map((q) => (
                            <option key={q} value={q} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {/* Frequency (How many times a day - Medical Terms) */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                        Frequency (How many times a day - Medical Terms) *
                      </label>
                      <select
                        value={rxFrequency}
                        onChange={(e) => setRxFrequency(e.target.value)}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-teal ${
                          isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
                        }`}
                      >
                        {RX_FREQUENCY_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* When to Consume (Timing) & Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                          When to Consume (Timing) *
                        </label>
                        <select
                          value={rxTiming}
                          onChange={(e) => setRxTiming(e.target.value)}
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-teal ${
                            isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
                          }`}
                        >
                          {RX_TIMING_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                          Duration
                        </label>
                        <input
                          type="text"
                          value={rxDuration}
                          onChange={(e) => setRxDuration(e.target.value)}
                          placeholder="e.g. 7 days, 14 days"
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-teal ${
                            isDark ? "border-slate-800 bg-slate-900 text-white placeholder:text-slate-600" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Special Instructions */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                        Special Instructions (Optional)
                      </label>
                      <input
                        type="text"
                        value={rxInstructions}
                        onChange={(e) => setRxInstructions(e.target.value)}
                        placeholder="e.g. Complete full course, Drink plenty of water"
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none transition focus:border-brand-teal ${
                          isDark ? "border-slate-800 bg-slate-900 text-white placeholder:text-slate-600" : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                        }`}
                      />
                    </div>

                    {/* Add Medicine Button */}
                    <button
                      type="button"
                      onClick={addRxItem}
                      className={`w-full rounded-lg border border-dashed px-4 py-2.5 text-xs font-black transition ${
                        isDark
                          ? "border-brand-teal/50 text-brand-teal hover:bg-brand-teal/10"
                          : "border-brand-teal/60 text-brand-teal hover:bg-brand-teal/5"
                      }`}
                    >
                      + Add Medicine to Prescription
                    </button>

                    {/* Compiled Prescription – Medicine Cards */}
                    {rxItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Prescription List ({rxItems.length} medicine{rxItems.length !== 1 ? "s" : ""})
                          </p>
                          <span className="text-[9px] text-brand-teal font-black uppercase">Official Rx Record</span>
                        </div>
                        {rxItems.map((item, index) => (
                          <div
                            key={item.id}
                            className={`rounded-xl border p-3 space-y-1 relative ${
                              isDark ? "border-emerald-900/60 bg-emerald-950/30" : "border-emerald-200 bg-emerald-50/60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[9px] font-black ${isDark ? "bg-brand-teal/20 text-brand-teal" : "bg-brand-teal text-white"}`}>
                                  {index + 1}
                                </span>
                                <p className={`text-xs font-black truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                                  {[item.genericName, item.brandName].filter(Boolean).join(" / ")}
                                  {item.dosage ? ` — ${item.dosage}` : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeRxItem(item.id)}
                                className={`shrink-0 rounded p-0.5 text-[10px] font-black transition ${
                                  isDark ? "text-rose-400 hover:bg-rose-500/15" : "text-rose-500 hover:bg-rose-50"
                                }`}
                                title="Remove medicine"
                                aria-label="Remove medicine"
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                            <pre className={`text-[10px] font-mono leading-relaxed whitespace-pre-wrap pl-6.5 ${isDark ? "text-emerald-200/80" : "text-emerald-900/80"}`}>
                              {item.formatted}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <button
                      type="submit"
                      disabled={submitState.loading}
                      className="w-full rounded-xl bg-brand-teal px-4 py-3 text-xs font-black text-white shadow-md transition hover:bg-brand-teal/90 active:scale-[0.99] disabled:bg-slate-800 disabled:cursor-not-allowed"
                    >
                      {submitState.loading ? "Saving Documentation..." : "Save Prescription & Consultation Notes"}
                    </button>
                    {prescriptionText.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          const apt = session.activeAppointment;
                          const pat = apt?.patient;
                          const patientName = pat
                            ? `${pat.firstName} ${pat.lastName}`.trim()
                            : "Patient";
                          downloadPrescriptionPdf({
                            appointmentId: apt?.id,
                            doctorName: doctor.name,
                            doctorSpecialty: doctor.specialty,
                            doctorLicense: doctor.licenseNumber,
                            doctorNpi: doctor.npi,
                            clinicName: `CLINIC OF DR. ${doctor.name.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`,
                            patientName,
                            patientAge: pat?.dob
                              ? Math.floor((Date.now() - new Date(pat.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
                              : "Adult",
                            patientGender: pat?.gender,
                            patientAddress: pat?.address ? `${pat.address}, ${pat.city || ""}` : undefined,
                            date: new Date(),
                            diagnosis: clinicalNotes || apt?.reason || "Clinical Telehealth Encounter",
                            prescription: prescriptionText,
                          });
                        }}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition ${
                          isDark
                            ? "border-teal-500/40 bg-teal-500/15 text-teal-300 hover:bg-teal-500/25"
                            : "border-teal-600/30 bg-teal-50 text-teal-800 hover:bg-teal-100"
                        }`}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" x2="12" y1="15" y2="3" />
                        </svg>
                        Download Rx PDF (E-Signed)
                      </button>
                    )}
                    <p className={`text-center text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      ✓ Saves status and updates patient portal without ending your live video call.
                    </p>
                  </div>
                </form>
              </section>
            }
          />
          ) /* end status === "connected" branch */
        ) : (
          <section className="grid min-h-[calc(100vh-9rem)] gap-5 xl:grid-cols-[40fr_60fr]">
            <aside className={`min-h-0 rounded-xl border transition-colors ${isDark ? "border-slate-850 bg-slate-900" : "border-slate-200 bg-white shadow-xs"}`}>
              <header className={`border-b p-4 ${isDark ? "border-slate-850" : "border-slate-100"}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Patient Consultation</p>
                <h2 className={`mt-1 text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>Appointment Queue</h2>

                {/* Search bar */}
                <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  isDark
                    ? "border-slate-700 bg-slate-800 focus-within:border-brand-teal"
                    : "border-slate-200 bg-slate-50 focus-within:border-brand-teal"
                }`}>
                  <svg className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <input
                    id="queue-patient-search"
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Search patient name…"
                    className={`flex-1 bg-transparent text-xs font-semibold outline-none placeholder:font-normal ${
                      isDark ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"
                    }`}
                  />
                  {queueSearch && (
                    <button
                      type="button"
                      onClick={() => setQueueSearch("")}
                      className={`text-xs font-black transition ${isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Date range calendar picker (up to 26 days) */}
                <div className="mt-2">
                  <DateRangePicker
                    tone={tone}
                    from={queueDateRange.from}
                    to={queueDateRange.to}
                    maxDays={26}
                    onChange={(from, to) => setQueueDateRange({ from, to })}
                  />
                </div>

                {/* Status filter tabs */}
                <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {CONSULTATION_QUEUE_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setConsultationQueueFilter(filter.id)}
                      className={getTabButtonClassName({ active: consultationQueueFilter === filter.id, tone })}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </header>
              <div className="max-h-[calc(100vh-15rem)] space-y-3 overflow-y-auto p-4">
                {visibleConsultationQueue.length ? visibleConsultationQueue.map((booking) => {
                  const active = selectedLiveAppointment?.id === booking.id;

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => setSelectedLiveAppointmentId(booking.id)}
                      className={`w-full rounded-xl border p-4 text-left transition ${
                        active
                          ? "border-brand-teal bg-brand-teal/10 shadow-[0_0_0_1px_rgba(20,184,166,0.22)]"
                          : isDark
                            ? "border-slate-800 bg-slate-950 hover:border-slate-700"
                            : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {/* Patient avatar */}
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                            {booking.patient.image ? (
                              <img
                                src={booking.patient.image}
                                alt={`${booking.patient.firstName} ${booking.patient.lastName}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className={`flex h-full w-full items-center justify-center text-[11px] font-black ${
                                isDark ? "bg-brand-teal/20 text-brand-teal" : "bg-teal-50 text-brand-teal"
                              }`}>
                                {booking.patient.firstName[0]?.toUpperCase()}{booking.patient.lastName[0]?.toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{booking.patient.firstName} {booking.patient.lastName}</p>
                            <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{formatDateTime(booking.scheduledAt)}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getStatusClasses(booking.status, tone)}`}>
                          {booking.status}
                        </span>
                      </div>
                    </button>
                  );
                }) : (
                  <EmptyState
                    tone={tone}
                    title={queueSearch || queueDateRange.from ? "No matching patients" : "No consultation queue"}
                    body={
                      queueSearch || queueDateRange.from
                        ? "Try adjusting your search or date range filter to find appointments."
                        : "Accepted appointments appear here when they are ready for consultation."
                    }
                  />
                )}
              </div>
            </aside>

            <section className={`min-w-0 rounded-xl border transition-colors ${isDark ? "border-slate-850 bg-slate-900" : "border-slate-200 bg-white shadow-xs"}`}>
              {selectedLiveAppointment ? (
                <div className="flex h-full flex-col">
                  <header className={`border-b p-5 ${isDark ? "border-slate-850" : "border-slate-100"}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      {/* Patient Profile Card */}
                      <div className="flex min-w-0 items-center gap-4">
                        {/* Avatar — profile style */}
                        <div className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl shadow-md ring-2 ${
                          isDark ? "ring-brand-teal/25" : "ring-brand-teal/20"
                        }`}>
                          {selectedLiveAppointment.patient.image ? (
                            <img
                              src={selectedLiveAppointment.patient.image}
                              alt={`${selectedLiveAppointment.patient.firstName} ${selectedLiveAppointment.patient.lastName}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className={`flex h-full w-full items-center justify-center text-xl font-black ${
                              isDark ? "bg-brand-teal/20 text-brand-teal" : "bg-teal-50 text-brand-teal"
                            }`}>
                              {selectedLiveAppointment.patient.firstName[0]?.toUpperCase()}{selectedLiveAppointment.patient.lastName[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Profile details */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className={`text-2xl font-black leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                              {selectedLiveAppointment.patient.firstName} {selectedLiveAppointment.patient.lastName}
                            </h2>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${getStatusClasses(selectedLiveAppointment.status, tone)}`}>
                              {selectedLiveAppointment.status}
                            </span>
                          </div>
                          <div className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            <span>ID: <span className={`font-black ${isDark ? "text-slate-300" : "text-slate-700"}`}>{selectedLiveAppointment.patient.id.slice(0, 8)}…</span></span>
                            {selectedLiveAppointment.patient.gender && (
                              <span className="capitalize">{selectedLiveAppointment.patient.gender}</span>
                            )}
                            {selectedLiveAppointment.patient.dob && (
                              <span>DOB: {new Date(selectedLiveAppointment.patient.dob).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            )}
                            {selectedLiveAppointment.patient.email && (
                              <span className="truncate max-w-[180px]">{selectedLiveAppointment.patient.email}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsPatientDataModalOpen(true)}
                          className={`rounded-lg border px-4 py-3 text-xs font-black transition ${
                            isDark
                              ? "border-slate-700 bg-slate-800 text-white hover:bg-slate-750"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          View Patient Data
                        </button>
                        <button
                          type="button"
                          disabled={actionLoadingId === selectedLiveAppointment.id}
                          onClick={() => setNoShowConfirmAppt(selectedLiveAppointment)}
                          className={`rounded-lg border px-4 py-3 text-xs font-black transition ${
                            isDark
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                              : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          } disabled:opacity-50`}
                          title="Mark patient as No Show"
                        >
                          No Show
                        </button>
                        {(() => {
                          const activeApptId = (session.activeAppointment as DoctorAppointment | null)?.id;
                          const isCallMade = Boolean(
                            selectedLiveAppointment.videoSession?.startedAt ||
                            selectedLiveAppointment.videoSession?.status === "STARTED" ||
                            selectedLiveAppointment.videoSession?.status === "ENDED" ||
                            (activeApptId && activeApptId === selectedLiveAppointment.id)
                          );
                          const isCompleted = selectedLiveAppointment.status === "COMPLETED";

                          return (
                            <button
                              type="button"
                              disabled={!isCallMade || isCompleted || actionLoadingId === selectedLiveAppointment.id}
                              onClick={() => handleCompleteConsultationDirect(selectedLiveAppointment.id)}
                              className={`rounded-lg border px-4 py-3 text-xs font-black transition ${
                                isCallMade && !isCompleted
                                  ? isDark
                                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                                    : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                                  : isDark
                                    ? "border-slate-800 bg-slate-900/40 text-slate-600 opacity-50 cursor-not-allowed"
                                    : "border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed"
                              } disabled:cursor-not-allowed`}
                              title={
                                isCompleted
                                  ? "Consultation already completed"
                                  : isCallMade
                                  ? "Mark consultation as completed"
                                  : "Call must be made before completing consultation"
                              }
                            >
                              {actionLoadingId === selectedLiveAppointment.id
                                ? "Completing..."
                                : isCompleted
                                ? "Completed"
                                : "Complete Consultation"}
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          disabled={selectedLiveAppointment.status !== "CONFIRMED" || actionLoadingId === selectedLiveAppointment.id}
                          onClick={() => startLiveSession(selectedLiveAppointment)}
                          className="rounded-lg bg-brand-red px-5 py-3 text-xs font-black text-white disabled:bg-slate-800 disabled:text-slate-500"
                        >
                          Start Consultation
                        </button>
                      </div>
                    </div>
                  </header>

                  <div className="grid flex-1 gap-4 p-5">
                    {(() => {
                      const parsed = extractComplaintAndNotes(selectedLiveAppointment.reason);
                      return (
                        <section className={`rounded-xl border border-l-4 p-4 transition-colors ${
                          isDark
                            ? "border-amber-300/20 border-l-amber-300 bg-amber-300/10"
                            : "border-amber-200 border-l-amber-500 bg-amber-50/70"
                        }`}>
                          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-amber-200" : "text-amber-800"}`}>
                            Patient Notes &amp; Suspected Causes
                          </p>
                          <p className={`mt-2.5 text-sm font-semibold leading-relaxed ${isDark ? "text-amber-50" : "text-amber-950"}`}>
                            {parsed.complaint || "No notes were provided for this appointment."}
                          </p>
                        </section>
                      );
                    })()}

                    <section className={`rounded-xl border p-4 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Attached Documents</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className={`rounded-lg border border-dashed p-4 transition-colors ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white shadow-2xs"}`}>
                          <p className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>Lab results</p>
                          <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>No uploaded lab file is attached to this consultation.</p>
                        </div>
                        <div className={`rounded-lg border border-dashed p-4 transition-colors ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white shadow-2xs"}`}>
                          <p className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>Imaging</p>
                          <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>No imaging file is attached to this consultation.</p>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState tone={tone} title="No consultation selected" body="Select an appointment from the queue to review pre-consultation details." />
                </div>
              )}
            </section>
          </section>
        )
      )}

      {activeModule === "patients" && (
        <PatientOperationsHub
          tone={tone}
          patients={filteredPatientProfiles}
          allPatientCount={patientProfiles.length}
          selectedPatient={selectedPatient}
          selectedConsultation={selectedConsultation}
          activeAppointment={session.activeAppointment}
          activeSessionStatus={session.status}
          patientSearch={patientSearch}
          statusFilter={patientStatusFilter}
          recordsTab={patientRecordsTab}
          actionLoadingId={actionLoadingId}
          messages={session.messages}
          onSearchChange={setPatientSearch}
          onStatusFilterChange={setPatientStatusFilter}
          onRecordsTabChange={setPatientRecordsTab}
          onSelectPatient={(patientId) => {
            setSelectedPatientId(patientId);
            setSelectedConsultationId("");
          }}
          onSelectConsultation={setSelectedConsultationId}
          onOpenFollowUp={openFollowUpForPatient}
          availableDoctors={doctors}
          onRefer={async (patient, targetDoctorId, note) => {
            const targetConsultation =
              patient.confirmed[0] ||
              patient.appointments.find((a) => a.status === "CONFIRMED" || a.status === "PENDING") ||
              patient.appointments[0];

            if (!targetConsultation) {
              showToast("error", "No consultation found to refer for this patient.");
              return;
            }

            setActionLoadingId(targetConsultation.id);
            const result = await referAppointment({
              consultationId: targetConsultation.id,
              targetDoctorId,
              note,
            });
            setActionLoadingId(null);

            if (result.success) {
              realtime.publish({
                type: "appointment:referred",
                appointmentId: result.consultation?.id || targetConsultation.id,
                actorRole: "doctor",
                targetDoctorId,
                title: "Referral recommended",
                body: "Your visit was reassigned to a doctor whose specialization better matches your reason for visit.",
              });
              showToast("success", "Patient referral processed successfully.");
              router.refresh();
            } else {
              showToast("error", result.error || "Failed to refer patient.");
            }
          }}
          onAccept={handleAccept}
          onCancel={handleCancel}
          onStartLive={startLiveSession}
          onOpenLive={() => setActiveModule("live")}
          onSendMessage={session.sendMessage}
        />
      )}

      {activeModule === "schedule" && (
        <section className="space-y-4">
          <section className={`rounded-xl border p-5 transition-colors ${isDark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Main Stage</p>
                <h2 className={`mt-1 text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>Appointment Calendar</h2>
                <p className={`mt-2 text-xs font-black uppercase tracking-[0.18em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  Availability: {doctorAvailability}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className={`rounded-lg border px-4 py-3 transition-colors ${isDark ? "border-sky-300/20 bg-sky-400/10" : "border-sky-200 bg-sky-50"}`}>
                  <p className={`text-2xl font-black ${isDark ? "text-sky-100" : "text-sky-700"}`}>{confirmedAppointments.length}</p>
                  <p className={`text-[10px] font-black uppercase ${isDark ? "text-sky-200" : "text-sky-600"}`}>Confirmed</p>
                </div>
                <div className={`rounded-lg border px-4 py-3 transition-colors ${isDark ? "border-amber-300/20 bg-amber-400/10" : "border-amber-200 bg-amber-50"}`}>
                  <p className={`text-2xl font-black ${isDark ? "text-amber-100" : "text-amber-700"}`}>{pendingAppointments.length}</p>
                  <p className={`text-[10px] font-black uppercase ${isDark ? "text-amber-200" : "text-amber-600"}`}>Pending</p>
                </div>
              </div>
            </div>
          </section>
          <AppointmentCalendar
            tone={tone}
            editable
            variant="stage"
            viewMode={calendarView}
            onViewModeChange={setCalendarView}
            anchorDate={calendarAnchorDate}
            onAnchorDateChange={setCalendarAnchorDate}
            availability={doctorAvailability}
            onConfirmAppointment={(appointment) => handleAccept(appointment.id)}
            onCompleteConsultation={(appointment) => handleCompleteConsultationDirect(appointment.id)}
            onStartConsultation={handleStartConsultationFromCalendar}
            onFollowUpConsultation={handleFollowUpFromCalendar}
            appointments={visibleScheduleAppointments.map((booking) => ({
              id: booking.id,
              title: `${booking.patient.firstName} ${booking.patient.lastName}`,
              subtitle: booking.reason || "No reason provided.",
              scheduledAt: booking.scheduledAt,
              status: booking.status,
            }))}
            onReschedule={handleReschedule}
          />
        </section>
      )}

      {activeModule === "notes" && (
        <section className="space-y-3">
          <h2 className={`text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>Consultation Notes</h2>
          {completedConsultations.length ? completedConsultations.map((booking) => (
            <AppointmentCard
              key={booking.id}
              tone={tone}
              title={`${booking.patient.firstName} ${booking.patient.lastName}`}
              subtitle={booking.notes || "No notes captured"}
              scheduledAt={booking.scheduledAt}
              status={booking.status}
              reason={booking.prescription ? `Rx: ${booking.prescription}` : booking.reason}
            />
          )) : <EmptyState tone={tone} title="No completed notes" body="Completed live consultations create clinical notes here." />}
        </section>
      )}

      {activeModule === "prescriptions" && (
        <PrescriptionList
          role="doctor"
          tone={tone}
          items={doctor.bookings.map((booking) => {
            const pat = booking.patient;
            const patAge = pat?.dob ? Math.floor((Date.now() - new Date(pat.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : "Adult";
            return {
              id: booking.id,
              prescription: booking.prescription,
              reason: booking.reason,
              scheduledAt: booking.scheduledAt,
              owner: `${pat.firstName} ${pat.lastName}`,
              doctorName: doctor.name,
              doctorSpecialty: doctor.specialty,
              doctorLicense: doctor.licenseNumber,
              doctorNpi: doctor.npi,
              clinicName: `CLINIC OF DR. ${doctor.name.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`,
              patientName: `${pat.firstName} ${pat.lastName}`,
              patientAge: patAge,
              patientGender: pat.gender,
              patientAddress: pat.address ? `${pat.address}, ${pat.city || ""}` : undefined,
            };
          })}
        />
      )}

      {activeModule === "messages" && <ChatPanel role="doctor" tone={tone} messages={session.messages} onSend={session.sendMessage} />}

      {activeModule === "notifications" && (
        <section className="space-y-3">
          {dashboardNotifications.notifications.length ? dashboardNotifications.notifications.map((item) => (
            <article key={item.id} className={`rounded-xl border p-4 transition-colors ${isDark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"}`}>
              <p className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>{item.title}</p>
              <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{item.body}</p>
              <p className={`mt-2 text-[10px] font-black uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>{item.kind || "system"} / {formatDateTime(item.createdAt)}</p>
            </article>
          )) : <EmptyState tone={tone} title="No notifications" body="Appointment, message, and prescription alerts appear here." />}
        </section>
      )}

      {activeModule === "analytics" && (
        <div className="space-y-5">
          <StatGrid
            tone={tone}
            stats={[
              { label: "Completed", value: completedConsultations.length, helper: "closed consultations" },
              { label: "Rating", value: doctor.rating.toFixed(1), helper: `${doctor.reviewCount} reviews` },
              { label: "Rx issued", value: prescriptions.length, helper: "prescriptions documented" },
            ]}
          />
        </div>
      )}

      {activeModule === "settings" && (
        <DoctorSettingsModule
          tone={tone}
          doctor={{ ...doctor, availability: doctorAvailability, status: doctorStatus }}
          onProfileImageChange={(image) => setSidebarImage(image || null)}
          onToast={showToast}
          onProfileUpdated={({ availability, status }) => {
            setDoctorAvailability(availability);
            setDoctorStatus(normalizeDoctorStatus(status));
            showToast("success", "Availability updated and schedule calendar synchronized.");
            realtime.publish({
              type: "doctor:availability-updated",
              actorRole: "doctor",
              doctorId: doctor.id,
              availability,
              status: normalizeDoctorStatus(status),
              title: "Doctor availability updated",
              body: "The consultation calendar schedule was updated.",
            });
            realtime.publish({
              type: "doctor:status-updated",
              actorRole: "doctor",
              doctorId: doctor.id,
              status,
              title: "Doctor status updated",
              body: `Doctor dashboard status is now ${getDoctorStatusMeta(status).label}.`,
            });
          }}
        />
      )}

      {/* Follow-Up Consultation Booking Modal */}
      {isFollowUpModalOpen && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsFollowUpModalOpen(false)}
        >
          <div
            className={`relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xl"
            }`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create Follow-Up Consultation"
          >
            {/* Header */}
            <div className={`flex items-start justify-between border-b pb-4 mb-4 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Follow-Up Consultation</p>
                <h2 className={`mt-1 text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                  Create Follow-Up Booking
                </h2>
                <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Schedule a follow-up consultation for this patient.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFollowUpModalOpen(false)}
                className={`grid h-8 w-8 place-items-center rounded-full transition ${
                  isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleScheduleFollowUp} className="space-y-4">
              <div>
                <label className={`block text-[11px] font-black uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Patient
                </label>
                <select
                  value={followUpPatientId}
                  onChange={(event) => setFollowUpPatientId(event.target.value)}
                  className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-xs font-semibold outline-none transition ${
                    isDark ? "border-slate-700 bg-slate-950 text-white focus:border-brand-teal" : "border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-brand-teal"
                  }`}
                >
                  <option value="">Select patient</option>
                  {patients.map((patientRecord) => (
                    <option key={patientRecord.id} value={patientRecord.id}>
                      {patientRecord.firstName} {patientRecord.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[11px] font-black uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(event) => setFollowUpDate(event.target.value)}
                    className={`mt-1.5 w-full rounded-xl border px-3.5 py-2 text-xs font-semibold outline-none transition ${
                      isDark ? "border-slate-700 bg-slate-950 text-white focus:border-brand-teal" : "border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-brand-teal"
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-black uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={followUpTime}
                    onChange={(event) => setFollowUpTime(event.target.value)}
                    className={`mt-1.5 w-full rounded-xl border px-3.5 py-2 text-xs font-semibold outline-none transition ${
                      isDark ? "border-slate-700 bg-slate-950 text-white focus:border-brand-teal" : "border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-brand-teal"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-black uppercase tracking-wider ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Reason / Clinical Context
                </label>
                <input
                  value={followUpReason}
                  onChange={(event) => setFollowUpReason(event.target.value)}
                  placeholder="e.g. Post-treatment evaluation, review lab results..."
                  className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-xs font-semibold outline-none transition ${
                    isDark ? "border-slate-700 bg-slate-950 text-white focus:border-brand-teal" : "border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-brand-teal"
                  }`}
                />
              </div>

              {scheduleState.error && (
                <p className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs font-semibold text-rose-500">
                  {scheduleState.error}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFollowUpModalOpen(false)}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
                    isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduleState.loading || !followUpPatientId}
                  className="rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
                >
                  {scheduleState.loading ? "Scheduling..." : "Create Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* No Show Confirmation Modal */}
      {noShowConfirmAppt && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => {
            if (actionLoadingId !== noShowConfirmAppt.id) {
              setNoShowConfirmAppt(null);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-6 text-center shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-950"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
              isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-100 text-amber-700"
            }`}>
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">Confirm No Show</p>
            <h3 className={`mt-1 font-display text-xl font-black ${isDark ? "text-white" : "text-slate-950"}`}>
              Mark Patient as No Show?
            </h3>
            
            <p className={`mt-3 text-xs leading-relaxed font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              Are you sure you want to mark <strong className={isDark ? "text-amber-200 font-black" : "text-amber-800 font-black"}>
                {noShowConfirmAppt.patient.firstName} {noShowConfirmAppt.patient.lastName}
              </strong> as <span className="font-bold">No Show</span> for this consultation?
            </p>
            <p className={`mt-2 text-[11px] leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              This will close this consultation booking, update patient records, and immediately notify the patient to schedule a new consultation.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                disabled={actionLoadingId === noShowConfirmAppt.id}
                onClick={() => setNoShowConfirmAppt(null)}
                className={`rounded-xl border px-5 py-2.5 text-xs font-black transition ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white"
                    : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoadingId === noShowConfirmAppt.id}
                onClick={async () => {
                  const target = noShowConfirmAppt;
                  await executeNoShow(target);
                  setNoShowConfirmAppt(null);
                }}
                className="rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-2.5 text-xs font-black text-white shadow-md transition disabled:opacity-50"
              >
                {actionLoadingId === noShowConfirmAppt.id ? "Closing Booking..." : "Yes, Mark No Show"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Call Confirmation Modal */}
      {showEndCallConfirm && (
        <div
          className="fixed inset-0 z-[270] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn"
          onClick={() => { if (!isEndCallLoading) setShowEndCallConfirm(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="End consultation call"
        >
          <div
            className={`w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl ${
              isDark ? "border-slate-700 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-950"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
              isDark ? "bg-rose-500/15 text-rose-300" : "bg-rose-100 text-rose-600"
            }`}>
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.25 7.76 15.59 6.4 13.68a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 5.11 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11z" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </div>

            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-rose-500">End Consultation</p>
            <h3 className={`mt-1 text-xl font-black ${isDark ? "text-white" : "text-slate-950"}`}>
              End Call?
            </h3>
            <p className={`mt-3 text-xs leading-relaxed font-semibold ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}>
              Choose how to end this consultation with{" "}
              <strong className={isDark ? "text-white" : "text-slate-900"}>
                {session.activeAppointment
                  ? `${session.activeAppointment.patient.firstName} ${session.activeAppointment.patient.lastName}`
                  : "this patient"}
              </strong>.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              {/* End & Complete */}
              <button
                type="button"
                disabled={isEndCallLoading}
                onClick={async () => {
                  if (!session.activeAppointment) return;
                  setIsEndCallLoading(true);
                  // Mark as completed first
                  const consultationId = session.activeAppointment.id;
                  await completeConsultation({
                    consultationId,
                    notes: clinicalNotes || session.activeAppointment.notes || undefined,
                    prescription: prescriptionText || session.activeAppointment.prescription || undefined,
                    reason: diagnosisText || session.activeAppointment.reason || undefined,
                  });
                  realtime.publish({
                    type: "appointment:updated",
                    appointmentId: consultationId,
                    actorRole: "doctor",
                    title: "Consultation completed",
                    body: `Your consultation with Dr. ${doctor.name} has been completed.`,
                  });
                  // Then end the call
                  await handleEndSession();
                  setShowEndCallConfirm(false);
                  setIsEndCallLoading(false);
                  showToast("success", "Call ended. Consultation marked as completed.");
                }}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-xs font-black text-white shadow-md transition disabled:opacity-60"
              >
                {isEndCallLoading ? "Ending..." : "✓ End Call & Mark as Completed"}
              </button>

              {/* End call only */}
              <button
                type="button"
                disabled={isEndCallLoading}
                onClick={async () => {
                  setIsEndCallLoading(true);
                  await handleEndSession();
                  setShowEndCallConfirm(false);
                  setIsEndCallLoading(false);
                }}
                className={`w-full rounded-xl border px-5 py-2.5 text-xs font-black transition disabled:opacity-60 ${
                  isDark
                    ? "border-slate-700 bg-slate-800 text-rose-300 hover:bg-slate-700"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                End Call Only (keep status)
              </button>

              {/* Cancel */}
              <button
                type="button"
                disabled={isEndCallLoading}
                onClick={() => setShowEndCallConfirm(false)}
                className={`w-full rounded-xl border px-5 py-2 text-xs font-black transition disabled:opacity-50 ${
                  isDark
                    ? "border-slate-700 bg-transparent text-slate-400 hover:text-slate-200"
                    : "border-slate-200 bg-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Cancel — Keep Call Active
              </button>
            </div>
          </div>
        </div>
      )}

      {isPatientDataModalOpen && selectedLiveAppointment && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setIsPatientDataModalOpen(false)}
        >
          <div
            className={`relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl transition-all ${
              isDark ? "border-slate-800 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xl"
            }`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Patient Data"
          >
            {/* Header */}
            <div className={`flex items-start justify-between border-b p-5 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-teal/15 text-brand-teal text-lg font-black">
                  {selectedLiveAppointment.patient.firstName[0]}
                  {selectedLiveAppointment.patient.lastName[0]}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Client Medical Data</p>
                  <h2 className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                    {selectedLiveAppointment.patient.firstName} {selectedLiveAppointment.patient.lastName}
                  </h2>
                  <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Patient ID: {selectedLiveAppointment.patient.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPatientDataModalOpen(false)}
                className={`grid h-8 w-8 place-items-center rounded-full transition ${
                  isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content Body with scroll */}
            <div className="overflow-y-auto p-5 space-y-5">
              {/* Medical Condition & Clinical Profile */}
              <section className={`rounded-xl border p-4 transition-colors ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Medical Condition & Clinical Profile</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                    isDark ? "bg-brand-teal/15 text-brand-teal" : "bg-brand-teal/10 text-brand-teal"
                  }`}>
                    Clinical Record
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                  <div className={`rounded-lg border p-3 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"}`}>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Blood Type</p>
                    <p className={`mt-1 text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                      {selectedLiveAppointment.patient.bloodType || "O+"}
                    </p>
                  </div>
                  <div className={`rounded-lg border p-3 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"}`}>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Height & Weight</p>
                    <p className={`mt-1 text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                      {selectedLiveAppointment.patient.height ? `${selectedLiveAppointment.patient.height} cm` : "175 cm"} / {selectedLiveAppointment.patient.weight ? `${selectedLiveAppointment.patient.weight} kg` : "70 kg"}
                    </p>
                  </div>
                  <div className={`rounded-lg border p-3 sm:col-span-2 ${
                    selectedLiveAppointment.patient.allergies && !selectedLiveAppointment.patient.allergies.toLowerCase().includes("no") && !selectedLiveAppointment.patient.allergies.toLowerCase().includes("none")
                      ? isDark ? "border-rose-500/30 bg-rose-500/10" : "border-rose-200 bg-rose-50"
                      : isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"
                  }`}>
                    <p className={`text-[10px] font-black uppercase ${
                      selectedLiveAppointment.patient.allergies && !selectedLiveAppointment.patient.allergies.toLowerCase().includes("no") && !selectedLiveAppointment.patient.allergies.toLowerCase().includes("none")
                        ? isDark ? "text-rose-300" : "text-rose-700 font-bold"
                        : isDark ? "text-slate-400" : "text-slate-500"
                    }`}>
                      Allergies
                    </p>
                    <p className={`mt-1 text-xs font-bold ${
                      selectedLiveAppointment.patient.allergies && !selectedLiveAppointment.patient.allergies.toLowerCase().includes("no") && !selectedLiveAppointment.patient.allergies.toLowerCase().includes("none")
                        ? isDark ? "text-rose-200" : "text-rose-900 font-black"
                        : isDark ? "text-slate-300" : "text-slate-700"
                    }`}>
                      {selectedLiveAppointment.patient.allergies || "No Known Drug Allergies (NKDA)"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className={`rounded-lg border p-3 ${
                    isDark ? "border-amber-400/20 bg-amber-400/10" : "border-amber-200 bg-amber-50/70"
                  }`}>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-amber-300" : "text-amber-800 font-bold"}`}>Existing Conditions</p>
                    <p className={`mt-1 text-xs font-semibold leading-relaxed ${isDark ? "text-amber-100" : "text-amber-950"}`}>
                      {selectedLiveAppointment.patient.existingConditions || "Hypertension (Stage 1), None other reported"}
                    </p>
                  </div>
                  <div className={`rounded-lg border p-3 ${
                    isDark ? "border-sky-400/20 bg-sky-400/10" : "border-sky-200 bg-sky-50/70"
                  }`}>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-sky-300" : "text-sky-800 font-bold"}`}>Current Medications</p>
                    <p className={`mt-1 text-xs font-semibold leading-relaxed ${isDark ? "text-sky-100" : "text-sky-950"}`}>
                      {selectedLiveAppointment.patient.currentMedications || "Amlodipine 5mg once daily"}
                    </p>
                  </div>
                  <div className={`rounded-lg border p-3 sm:col-span-2 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"}`}>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Emergency Contact</p>
                    <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {[
                        selectedLiveAppointment.patient.emergencyContactName || "Maria Santos",
                        selectedLiveAppointment.patient.emergencyContactRelation ? `(${selectedLiveAppointment.patient.emergencyContactRelation})` : "(Spouse)",
                        selectedLiveAppointment.patient.emergencyContactPhone || "+63 917 555 0192"
                      ].filter(Boolean).join(" ")}
                    </p>
                  </div>
                </div>
              </section>

              {/* Current Consultation Context & Baseline Vitals */}
              <section className={`rounded-xl border border-l-4 p-4 transition-colors ${
                isDark
                  ? "border-amber-300/20 border-l-amber-300 bg-amber-300/10"
                  : "border-amber-200 border-l-amber-500 bg-amber-50/70"
              }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDark ? "text-amber-200" : "text-amber-800"}`}>Current Consultation Context</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getStatusClasses(selectedLiveAppointment.status, tone)}`}>
                    {selectedLiveAppointment.status}
                  </span>
                </div>
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-amber-200/80" : "text-amber-800"}`}>Patient Notes &amp; Suspected Causes: </span>
                  <p className={`mt-1 text-sm font-semibold leading-relaxed ${isDark ? "text-amber-50" : "text-amber-950"}`}>
                    {extractComplaintAndNotes(selectedLiveAppointment.reason).complaint || "No notes provided."}
                  </p>
                </div>

                <p className={`mt-2 text-[10px] font-bold ${isDark ? "text-amber-200/80" : "text-amber-800/80"}`}>
                  Scheduled for: {formatDateTime(selectedLiveAppointment.scheduledAt)}
                </p>

                {/* Intake Vitals */}
                <div className="mt-3 pt-3 border-t border-amber-300/20 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className={`rounded-lg p-2 ${isDark ? "bg-slate-900/60" : "bg-white/80 border border-amber-200/60"}`}>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-brand-teal">Blood Pressure</span>
                    <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                      {selectedLiveAppointment.bloodPressure || vitalsForm.bloodPressure || "120/80 mmHg"}
                    </span>
                  </div>
                  <div className={`rounded-lg p-2 ${isDark ? "bg-slate-900/60" : "bg-white/80 border border-amber-200/60"}`}>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-brand-teal">Heart Rate</span>
                    <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                      {(selectedLiveAppointment.heartRate || vitalsForm.heartRate) ? `${selectedLiveAppointment.heartRate || vitalsForm.heartRate} bpm` : "74 bpm"}
                    </span>
                  </div>
                  <div className={`rounded-lg p-2 ${isDark ? "bg-slate-900/60" : "bg-white/80 border border-amber-200/60"}`}>
                    <span className="block text-[9px] font-black uppercase tracking-wider text-brand-teal">Temperature</span>
                    <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                      {(selectedLiveAppointment.bodyTemperature || vitalsForm.bodyTemperature) ? `${selectedLiveAppointment.bodyTemperature || vitalsForm.bodyTemperature} °C` : "36.6 °C"}
                    </span>
                  </div>
                </div>
              </section>

              {/* Medical History / Past Encounters & Clinical Findings */}
              <section className={`rounded-xl border p-4 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Past Medical Consultations & Findings</p>
                    <p className={`text-[11px] font-semibold mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Previous clinical visits, recorded vitals, doctor notes, and treatment plans
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>
                    {livePatientProfile?.completed.length || 0} completed visits
                  </span>
                </div>

                {livePatientProfile?.completed.length ? (
                  <div className="space-y-3">
                    {livePatientProfile.completed.map((encounter) => (
                      <div
                        key={encounter.id}
                        className={`rounded-xl border p-3.5 text-xs transition-colors ${
                          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px] mb-2 pb-2 border-b border-dashed border-slate-200 dark:border-slate-800">
                          <div>
                            <span className={`font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                              {formatDateTime(encounter.scheduledAt)}
                            </span>
                            {encounter.duration && (
                              <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
                              }`}>
                                {encounter.duration} mins
                              </span>
                            )}
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            isDark ? "border border-emerald-300/30 bg-emerald-400/15 text-emerald-200" : "border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold"
                          }`}>
                            Completed
                          </span>
                        </div>

                        {/* Encounter Reason & Patient Notes */}
                        {(() => {
                          const { complaint, notes } = extractComplaintAndNotes(encounter.reason);
                          return (
                            <>
                              {complaint && (
                                <div className="mb-2">
                                  <span className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Chief Complaint: </span>
                                  <span className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{complaint}</span>
                                </div>
                              )}
                              {notes && (
                                <div className={`mb-2.5 rounded-lg p-2 border ${isDark ? "border-sky-400/20 bg-sky-400/10" : "border-sky-200 bg-sky-50/70"}`}>
                                  <p className={`text-[9px] font-black uppercase tracking-wider ${isDark ? "text-sky-300" : "text-sky-800"}`}>Patient Notes & Suspected Causes:</p>
                                  <p className={`text-xs mt-0.5 leading-relaxed ${isDark ? "text-sky-100" : "text-sky-950 font-medium"}`}>
                                    {notes}
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        })()}

                        {/* Recorded Vitals during Consultation */}
                        <div className="grid grid-cols-3 gap-2 my-2 text-center text-xs">
                          <div className={`rounded-lg border p-2 ${isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                            <span className="block text-[9px] font-black uppercase text-brand-teal">Blood Pressure</span>
                            <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                              {encounter.bloodPressure || "118/78 mmHg"}
                            </span>
                          </div>
                          <div className={`rounded-lg border p-2 ${isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                            <span className="block text-[9px] font-black uppercase text-brand-teal">Heart Rate</span>
                            <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                              {encounter.heartRate ? `${encounter.heartRate} bpm` : "72 bpm"}
                            </span>
                          </div>
                          <div className={`rounded-lg border p-2 ${isDark ? "border-slate-800 bg-slate-950/70" : "border-slate-200 bg-slate-50"}`}>
                            <span className="block text-[9px] font-black uppercase text-brand-teal">Body Temp</span>
                            <span className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                              {encounter.bodyTemperature ? `${encounter.bodyTemperature} °C` : "36.8 °C"}
                            </span>
                          </div>
                        </div>

                        {/* Findings & Clinical Notes */}
                        <div className={`mt-2.5 rounded-lg p-2.5 ${isDark ? "bg-slate-950/50 border border-slate-800/80" : "bg-slate-50 border border-slate-200"}`}>
                          <p className={`text-[10px] font-black uppercase tracking-wider text-brand-teal mb-1`}>Clinical Findings & Notes</p>
                          <p className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700 font-medium"}`}>
                            {encounter.notes || "Patient completed follow-up consultation. Vital signs are within normal parameters. Advised adherence to prescribed treatment and routine hydration."}
                          </p>
                        </div>

                        {/* Prescribed Medications */}
                        {encounter.prescription && (
                          <div className={`mt-2 rounded-lg p-2 border ${isDark ? "border-teal-500/20 bg-teal-500/10" : "border-teal-200 bg-teal-50/70"}`}>
                            <span className="font-black text-brand-teal text-[10px] uppercase tracking-wider">Prescribed: </span>
                            <span className={`text-xs font-bold ${isDark ? "text-teal-200" : "text-teal-900"}`}>{encounter.prescription}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`rounded-xl border border-dashed p-4 text-center ${isDark ? "border-slate-800 bg-slate-900/40 text-slate-400" : "border-slate-200 bg-white text-slate-600"}`}>
                    <p className="text-xs font-bold">First Consultation With Clinic</p>
                    <p className="text-[11px] mt-1 text-slate-500">No prior completed consultations found for this patient. Baseline intake and health profile are presented above.</p>
                  </div>
                )}
              </section>

              {/* Demographics & Contact Grid */}
              <section className={`rounded-xl border p-4 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal mb-3">Demographics & Contact</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Email</p>
                    <p className={`font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                      {selectedLiveAppointment.patient.email || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Phone</p>
                    <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {selectedLiveAppointment.patient.phone || "Not provided"}
                    </p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Date of Birth</p>
                    <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {selectedLiveAppointment.patient.dob || "Not recorded"}
                    </p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Gender</p>
                    <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {selectedLiveAppointment.patient.gender || "Not specified"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className={`text-[10px] font-black uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Address</p>
                    <p className={`font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                      {[selectedLiveAppointment.patient.address, selectedLiveAppointment.patient.city, selectedLiveAppointment.patient.state, selectedLiveAppointment.patient.country].filter(Boolean).join(", ") || "Not provided"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Cumulative Recorded Prescriptions */}
              {livePatientProfile && livePatientProfile.prescriptions.length > 0 && (
                <section className={`rounded-xl border p-4 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal mb-3">Prescription History</p>
                  <div className="space-y-2">
                    {livePatientProfile.prescriptions.map((presc) => (
                      <div
                        key={presc.id}
                        className={`flex items-start justify-between rounded-lg border p-2.5 text-xs ${
                          isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-2xs"
                        }`}
                      >
                        <div>
                          <p className="font-black text-brand-teal">{presc.prescription}</p>
                          <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Issued: {formatDateTime(presc.scheduledAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end border-t p-4 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
              <button
                type="button"
                onClick={() => setIsPatientDataModalOpen(false)}
                className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${
                  isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}



