"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/dashboard/format";
import { parseAvailability, getEffectiveAvailabilityWindow } from "@/lib/scheduling";

export type CalendarViewMode = "day" | "week" | "month";

export type CalendarAppointment = {
  id: string;
  title: string;
  subtitle: string;
  scheduledAt: Date | string;
  status: string;
  reason?: string | null;
  duration?: number | null;
  notes?: string | null;
  patient?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    image?: string | null;
    phone?: string | null;
    dob?: string | null;
    gender?: string | null;
    height?: string | null;
    weight?: string | null;
    bloodType?: string | null;
    allergies?: string | null;
    existingConditions?: string | null;
    currentMedications?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
  } | null;
};

function getPatientAge(dob?: string | null): string {
  if (!dob) return "";
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return "";
  const diff = Date.now() - birth.getTime();
  const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  return age > 0 ? `${age} yrs` : "< 1 yr";
}

function getPatientInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function setTime(date: Date, hour: number) {
  const next = new Date(date);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function toLocalDateTimeValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:00`;
}

function sameSlot(value: Date | string, slot: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === slot.getFullYear() &&
    date.getMonth() === slot.getMonth() &&
    date.getDate() === slot.getDate() &&
    date.getHours() === slot.getHours()
  );
}

function sameDay(value: Date | string, day: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function moveAppointmentToDay(appointmentDate: Date | string, day: Date) {
  const original = new Date(appointmentDate);
  const next = new Date(day);
  next.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return next.toISOString();
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function getCalendarDays(viewMode: CalendarViewMode, anchorDate: Date) {
  if (viewMode === "day") {
    return [startOfDay(anchorDate)];
  }

  if (viewMode === "month") {
    const monthStart = startOfMonth(anchorDate);
    return Array.from({ length: daysInMonth(anchorDate) }, (_, index) => addDays(monthStart, index));
  }

  const weekStart = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function getViewLabel(viewMode: CalendarViewMode) {
  return viewMode === "day" ? "Day" : viewMode === "week" ? "Week" : "Month";
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

function AppointmentBlock({
  appointment,
  editable,
  compact = false,
  onSelect,
  tone = "light",
}: {
  appointment: CalendarAppointment;
  editable: boolean;
  compact?: boolean;
  onSelect: (appointment: CalendarAppointment, rect: DOMRect) => void;
  tone?: "light" | "dark";
}) {
  const confirmed = appointment.status === "CONFIRMED";
  const pending = appointment.status === "PENDING";
  const completed = appointment.status === "COMPLETED";
  const cancelled = appointment.status === "CANCELLED";
  const dark = tone === "dark";

  const statusColor = confirmed
    ? dark
      ? "border-sky-400/30 border-l-sky-400 bg-sky-500/15 text-sky-100 hover:border-sky-400/60 hover:bg-sky-500/25"
      : "border-sky-200 border-l-sky-500 bg-sky-50/90 text-sky-950 shadow-2xs hover:border-sky-300 hover:bg-sky-100"
    : pending
      ? dark
        ? "border-amber-400/30 border-l-amber-400 bg-amber-500/15 text-amber-100 hover:border-amber-400/60 hover:bg-amber-500/25"
        : "border-amber-200 border-l-amber-500 bg-amber-50/90 text-amber-950 shadow-2xs hover:border-amber-300 hover:bg-amber-100"
      : completed
        ? dark
          ? "border-emerald-400/30 border-l-emerald-400 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/60 hover:bg-emerald-500/25"
          : "border-emerald-200 border-l-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-2xs hover:border-emerald-300 hover:bg-emerald-100"
        : cancelled
          ? dark
            ? "border-rose-400/30 border-l-rose-400 bg-rose-500/15 text-rose-100 hover:border-rose-400/60 hover:bg-rose-500/25"
            : "border-rose-200 border-l-rose-500 bg-rose-50/90 text-rose-950 shadow-2xs hover:border-rose-300 hover:bg-rose-100"
          : dark
            ? "border-slate-700 border-l-slate-400 bg-slate-800 text-slate-100 hover:bg-slate-750"
            : "border-slate-200 border-l-slate-400 bg-slate-100 text-slate-800 hover:bg-slate-200/70";

  const badgeColor = confirmed
    ? dark
      ? "bg-sky-400/20 text-sky-200 border-sky-400/30"
      : "bg-sky-100 text-sky-800 border-sky-300"
    : pending
      ? dark
        ? "bg-amber-400/20 text-amber-200 border-amber-400/30"
        : "bg-amber-100 text-amber-800 border-amber-300"
      : completed
        ? dark
          ? "bg-emerald-400/20 text-emerald-200 border-emerald-400/30"
          : "bg-emerald-100 text-emerald-800 border-emerald-300"
        : cancelled
          ? dark
            ? "bg-rose-400/20 text-rose-200 border-rose-400/30"
            : "bg-rose-100 text-rose-800 border-rose-300"
          : dark
            ? "bg-slate-700 text-slate-300 border-slate-600"
            : "bg-slate-200 text-slate-700 border-slate-300";

  const subtitleColor = confirmed
    ? dark ? "text-sky-300/80" : "text-sky-800/80"
    : pending
      ? dark ? "text-amber-300/80" : "text-amber-800/80"
      : completed
        ? dark ? "text-emerald-300/80" : "text-emerald-800/80"
        : cancelled
          ? dark ? "text-rose-300/80" : "text-rose-800/80"
          : dark ? "text-slate-400" : "text-slate-600";

  const badgeLabel = confirmed ? "CNF" : pending ? "REQ" : completed ? "CMP" : cancelled ? "CAN" : appointment.status.slice(0, 3);
  const timeFormatted = formatDateTime(appointment.scheduledAt);

  return (
    <article
      draggable={editable && !completed && !cancelled}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", appointment.id)}
      onClick={(event) => {
        event.stopPropagation();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        onSelect(appointment, rect);
      }}
      className={`h-full min-h-[58px] flex flex-col justify-between rounded-md border border-l-[3.5px] shadow-xs transition select-none ${
        compact ? "p-1.5 text-[10px]" : "p-2 text-xs"
      } ${statusColor} cursor-pointer active:scale-[0.98] hover:z-20 hover:shadow-md`}
      title={`${appointment.title} - ${appointment.subtitle} (${appointment.status}) at ${timeFormatted} — Click to manage`}
    >
      <div className="flex items-center justify-between gap-1 overflow-hidden">
        <span className="truncate font-black leading-tight">{appointment.title}</span>
        <span className={`shrink-0 rounded px-1 py-0.2 text-[8px] font-black uppercase border ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 overflow-hidden">
        <p className={`truncate text-[9px] font-bold ${subtitleColor}`}>
          {compact ? timeFormatted.split(",")[1]?.trim() || timeFormatted : appointment.subtitle}
        </p>
      </div>
    </article>
  );
}

function AppointmentActionPopup({
  appointment,
  anchorRect,
  onClose,
  onViewPatient,
  onConfirmAppointment,
  onCancelAppointment,
  onCompleteConsultation,
  onStartConsultation,
  onFollowUpConsultation,
  tone = "light",
}: {
  appointment: CalendarAppointment;
  anchorRect: DOMRect;
  onClose: () => void;
  onViewPatient?: (appointment: CalendarAppointment) => void;
  onConfirmAppointment?: (appointment: CalendarAppointment) => void;
  onCancelAppointment?: (appointment: CalendarAppointment) => void;
  onCompleteConsultation?: (appointment: CalendarAppointment) => void;
  onStartConsultation?: (appointment: CalendarAppointment) => void;
  onFollowUpConsultation?: (appointment: CalendarAppointment) => void;
  tone?: "light" | "dark";
}) {
  const confirmed = appointment.status === "CONFIRMED";
  const pending = appointment.status === "PENDING";
  const completed = appointment.status === "COMPLETED";
  const cancelled = appointment.status === "CANCELLED";
  const dark = tone === "dark";

  const popupRef = useRef<HTMLDivElement>(null);

  // Compute popover position anchored to the clicked element rect
  const POPOVER_WIDTH = 296;
  const GAP = 8;

  const spaceRight = window.innerWidth - anchorRect.right;
  const spaceLeft = anchorRect.left;
  const openRight = spaceRight >= POPOVER_WIDTH + GAP || spaceRight >= spaceLeft;

  let left: number;
  let arrowSide: "left" | "right";
  if (openRight) {
    left = Math.min(anchorRect.right + GAP, window.innerWidth - POPOVER_WIDTH - 8);
    arrowSide = "left";
  } else {
    left = Math.max(anchorRect.left - POPOVER_WIDTH - GAP, 8);
    arrowSide = "right";
  }

  // Vertical: align top of popover with top of anchor, clamp to viewport
  const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - 440));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const statusLabel = confirmed ? "Confirmed" : pending ? "Pending Request" : completed ? "Completed" : cancelled ? "Cancelled" : appointment.status;
  const statusColor = confirmed ? "text-sky-400" : pending ? "text-amber-400" : completed ? "text-emerald-400" : cancelled ? "text-rose-400" : "text-slate-400";
  const statusDot = confirmed ? "bg-sky-400" : pending ? "bg-amber-400" : completed ? "bg-emerald-400" : cancelled ? "bg-rose-400" : "bg-slate-500";

  // Patient metadata
  const patient = appointment.patient;
  const patientName = patient?.firstName
    ? `${patient.firstName} ${patient.lastName || ""}`.trim()
    : appointment.title;
  const patientInitials = getPatientInitials(patientName);
  const patientAge = getPatientAge(patient?.dob);

  // Arrow pointing from popover toward the anchor element
  const arrowTop = Math.max(12, Math.min(anchorRect.top + anchorRect.height / 2 - top - 6, 200));

  return (
    <div
      className="fixed inset-0 z-[200]"
      style={{ pointerEvents: "none" }}
    >
      {/* Invisible click-away layer */}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: "auto" }}
        onClick={onClose}
      />

      {/* Popover card */}
      <div
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        aria-label="Appointment action"
        style={{
          position: "fixed",
          top,
          left,
          width: POPOVER_WIDTH,
          pointerEvents: "auto",
        }}
        className={`overflow-hidden rounded-2xl border shadow-2xl transition-all ${
          dark
            ? "border-slate-700/80 bg-slate-900 text-white ring-1 ring-white/10"
            : "border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-900/5"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Arrow caret */}
        <div
          className="absolute"
          style={{
            top: arrowTop,
            ...(arrowSide === "left"
              ? {
                  left: -6,
                  borderRight: `6px solid ${dark ? "#0f172a" : "#ffffff"}`,
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                }
              : {
                  right: -6,
                  borderLeft: `6px solid ${dark ? "#0f172a" : "#ffffff"}`,
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                }),
            width: 0,
            height: 0,
          }}
        />

        {/* Header & Patient Data Section (Same with view patient data on notification) */}
        <div className={`border-b px-4 pb-3.5 pt-3.5 ${dark ? "border-slate-800 bg-slate-900/90" : "border-slate-100 bg-slate-50/60"}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal">
              Patient Encounter
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              pending
                ? dark ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" : "bg-amber-50 text-amber-800 border border-amber-300"
                : confirmed
                  ? dark ? "bg-sky-400/20 text-sky-300 border border-sky-400/30" : "bg-sky-50 text-sky-800 border border-sky-300"
                  : completed
                    ? dark ? "bg-emerald-400/20 text-emerald-300 border border-emerald-400/30" : "bg-emerald-50 text-emerald-800 border border-emerald-300"
                    : dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              {statusLabel}
            </span>
          </div>

          {/* Patient Card Preview */}
          <div className="mt-3 flex items-start gap-3">
            {patient?.image ? (
              <img
                src={patient.image}
                alt={patientName}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-brand-teal/40"
              />
            ) : (
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black ring-2 ${
                dark
                  ? "bg-brand-teal/20 text-brand-teal ring-brand-teal/30"
                  : "bg-teal-50 text-teal-700 ring-teal-200"
              }`}>
                {patientInitials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-black leading-tight ${dark ? "text-white" : "text-slate-900"}`}>
                {patientName}
              </p>

              {/* Demographics: Age, Gender, Blood type */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                {patientAge && (
                  <span className={dark ? "text-slate-300" : "text-slate-600"}>
                    {patientAge}
                  </span>
                )}
                {patientAge && patient?.gender && (
                  <span className={dark ? "text-slate-600" : "text-slate-300"}>•</span>
                )}
                {patient?.gender && (
                  <span className={dark ? "text-slate-300" : "text-slate-600"}>
                    {patient.gender}
                  </span>
                )}
                {patient?.bloodType && (
                  <span className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase ${
                    dark ? "bg-rose-950/60 text-rose-300 border border-rose-900/50" : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {patient.bloodType}
                  </span>
                )}
              </div>

              {/* Email / Contact */}
              {patient?.email && (
                <p className={`mt-0.5 truncate text-[10px] font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>
                  {patient.email}
                </p>
              )}
            </div>
          </div>

          {/* Schedule Time & Reason Box */}
          <div className={`mt-3 rounded-xl border p-2.5 ${dark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-white"}`}>
            <div className="flex items-center justify-between text-[10px] font-semibold">
              <span className={`flex items-center gap-1.5 ${dark ? "text-slate-300" : "text-slate-700"}`}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-brand-teal">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                </svg>
                {formatDateTime(appointment.scheduledAt)}
              </span>
              {appointment.duration ? (
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${dark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"}`}>
                  {appointment.duration} min
                </span>
              ) : null}
            </div>

            {/* Chief Complaint / Reason */}
            <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
              <p className={`text-[9px] font-black uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>
                Reason for Visit
              </p>
              <p className={`mt-0.5 text-xs font-semibold leading-snug line-clamp-2 ${dark ? "text-slate-200" : "text-slate-800"}`}>
                {appointment.reason || appointment.subtitle || "General Telehealth Consultation"}
              </p>
            </div>

            {/* Quick Allergy Tag if available */}
            {patient?.allergies && patient.allergies.toLowerCase() !== "none" && (
              <div className={`mt-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                dark ? "bg-amber-950/40 text-amber-300 border border-amber-900/40" : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}>
                <span>⚠️ Allergy:</span>
                <span className="truncate">{patient.allergies}</span>
              </div>
            )}
          </div>

          {/* View Patient & Confirm / Reject Button (Same with notification) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onViewPatient?.(appointment);
            }}
            className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 px-3 text-xs font-black uppercase tracking-wider transition shadow-2xs active:scale-[0.98] ${
              dark
                ? "border-brand-teal/40 bg-brand-teal/15 text-brand-teal hover:bg-brand-teal/25"
                : "border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            View Patient Data
          </button>
        </div>


        {/* Actions */}
        <div className="p-2 space-y-0.5">
          {pending && (
            <>
              <button
                type="button"
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
                  dark
                    ? "text-emerald-200 hover:bg-emerald-500/20 hover:text-white"
                    : "text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
                }`}
                onClick={() => {
                  onClose();
                  onConfirmAppointment?.(appointment);
                }}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span>
                  <span className="block font-black">Confirm Appointment</span>
                  <span className={`block text-[10px] font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>Accept and confirm booking</span>
                </span>
              </button>

              <button
                type="button"
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
                  dark
                    ? "text-rose-300 hover:bg-rose-500/20 hover:text-rose-100"
                    : "text-rose-700 hover:bg-rose-50 hover:text-rose-900"
                }`}
                onClick={() => {
                  onClose();
                  onCancelAppointment?.(appointment);
                }}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-500/20 text-rose-400">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </span>
                <span>
                  <span className="block font-black">Reject Request</span>
                  <span className={`block text-[10px] font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>Decline this booking</span>
                </span>
              </button>
            </>
          )}

          {confirmed && (
            <>
              <button
                type="button"
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
                  dark
                    ? "text-slate-200 hover:bg-brand-teal/20 hover:text-white"
                    : "text-slate-700 hover:bg-brand-teal/10 hover:text-slate-950"
                }`}
                onClick={() => {
                  onClose();
                  onStartConsultation?.(appointment);
                }}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-teal/20 text-brand-teal">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3l14 9-14 9V3z" />
                  </svg>
                </span>
                <span>
                  <span className="block font-black">Start Consultation</span>
                  <span className={`block text-[10px] font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>Open live session</span>
                </span>
              </button>

              <button
                type="button"
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
                  dark
                    ? "text-emerald-200 hover:bg-emerald-500/20 hover:text-white"
                    : "text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
                }`}
                onClick={() => {
                  onClose();
                  onCompleteConsultation?.(appointment);
                }}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
                <span>
                  <span className="block font-black">Complete Consultation</span>
                  <span className={`block text-[10px] font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>Mark visit as completed</span>
                </span>
              </button>
            </>
          )}

          {completed && (
            <button
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition ${
                dark
                  ? "text-slate-200 hover:bg-emerald-400/20 hover:text-emerald-100"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-950"
              }`}
              onClick={() => {
                onClose();
                onFollowUpConsultation?.(appointment);
              }}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span>
                <span className="block font-black">Follow Up Consultation</span>
                <span className={`block text-[10px] font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>Schedule follow-up visit</span>
              </span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export function AppointmentCalendar({
  appointments,
  tone = "light",
  editable = false,
  onReschedule,
  onViewPatient,
  onConfirmAppointment,
  onCancelAppointment,
  onCompleteConsultation,
  onStartConsultation,
  onFollowUpConsultation,
  variant = "standard",
  viewMode = "week",
  onViewModeChange,
  anchorDate,
  onAnchorDateChange,
  availability,
}: {
  appointments: CalendarAppointment[];
  tone?: "light" | "dark";
  editable?: boolean;
  onReschedule?: (appointmentId: string, scheduledAt: string) => void;
  onViewPatient?: (appointment: CalendarAppointment) => void;
  onConfirmAppointment?: (appointment: CalendarAppointment) => void;
  onCancelAppointment?: (appointment: CalendarAppointment) => void;
  onCompleteConsultation?: (appointment: CalendarAppointment) => void;
  onStartConsultation?: (appointment: CalendarAppointment) => void;
  onFollowUpConsultation?: (appointment: CalendarAppointment) => void;
  variant?: "standard" | "stage";
  viewMode?: CalendarViewMode;
  onViewModeChange?: (viewMode: CalendarViewMode) => void;
  anchorDate?: Date;
  onAnchorDateChange?: (date: Date) => void;
  availability?: string | null;
}) {
  const resolvedAnchorDate = startOfDay(anchorDate || new Date());
  const [selectedEntry, setSelectedEntry] = useState<{ appointment: CalendarAppointment; rect: DOMRect } | null>(null);
  const days = getCalendarDays(viewMode, resolvedAnchorDate);
  const availabilityWindow = getEffectiveAvailabilityWindow(availability);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const dark = tone === "dark";
  const stage = variant === "stage";
  const periodLabel = viewMode === "month"
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(resolvedAnchorDate)
    : `${formatMonthDay(days[0])}${days.length > 1 ? ` - ${formatMonthDay(days[days.length - 1])}` : ""}`;
  const columnMinWidth = viewMode === "month" ? "minmax(96px,1fr)" : viewMode === "day" ? "minmax(320px,1fr)" : "minmax(126px,1fr)";
  const columnPixelWidth = viewMode === "day" ? 320 : 136;
  const gridMinWidth = 72 + days.length * columnPixelWidth;
  const stepUnit = viewMode === "month" ? "month" : viewMode === "day" ? "day" : "week";
  const stepCalendar = (direction: -1 | 1) => {
    if (!onAnchorDateChange) {
      return;
    }

    const amount = direction * (viewMode === "week" ? 7 : 1);
    onAnchorDateChange(stepUnit === "month" ? startOfMonth(addMonths(resolvedAnchorDate, direction)) : addDays(resolvedAnchorDate, amount));
  };

  return (
    <section className={`rounded-xl border ${stage ? "p-3 sm:p-4" : "p-4"} ${dark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-950"}`}>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Calendar</p>
          <h2 className={stage ? "text-xl font-black" : "text-lg font-black"}>Consultation Schedule</h2>
        </div>
        {stage && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
            <button
              type="button"
              onClick={() => stepCalendar(-1)}
              className={`grid h-8 w-8 place-items-center rounded-full transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-teal/40 ${
                dark ? "bg-white/10 text-slate-200 hover:bg-white/15" : "border border-slate-200 bg-white text-slate-700 hover:border-brand-teal/40"
              }`}
              aria-label="Previous calendar period"
            >
              <ChevronIcon direction="left" />
            </button>
            <span className={`rounded-full px-2.5 py-1 ${dark ? "bg-white/10 text-slate-200" : "border border-slate-200 bg-white text-slate-700"}`}>
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => stepCalendar(1)}
              className={`grid h-8 w-8 place-items-center rounded-full transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-teal/40 ${
                dark ? "bg-white/10 text-slate-200 hover:bg-white/15" : "border border-slate-200 bg-white text-slate-700 hover:border-brand-teal/40"
              }`}
              aria-label="Next calendar period"
            >
              <ChevronIcon direction="right" />
            </button>
            <label className="relative">
              <span className="sr-only">Calendar view</span>
              <select
                value={viewMode}
                onChange={(event) => onViewModeChange?.(event.target.value as CalendarViewMode)}
                className={`h-8 appearance-none rounded-full px-3 pr-8 text-[10px] font-black uppercase outline-none transition focus:ring-2 focus:ring-brand-teal/30 ${
                  dark
                    ? "border border-white/10 bg-slate-950 text-white hover:border-brand-teal/60 focus:border-brand-teal"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-brand-teal/40 focus:border-brand-teal"
                }`}
              >
                {(["day", "week", "month"] as const).map((mode) => (
                  <option key={mode} value={mode}>
                    {getViewLabel(mode)}
                  </option>
                ))}
              </select>
              <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${dark ? "text-slate-400" : "text-slate-500"}`}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </label>
            <span className={`rounded-full px-2.5 py-1 ${dark ? "bg-sky-400/15 text-sky-200 border border-sky-400/30" : "border border-sky-300 bg-sky-50 text-sky-800"}`}>Confirmed</span>
            <span className={`rounded-full px-2.5 py-1 ${dark ? "bg-amber-400/15 text-amber-200 border border-amber-400/30" : "border border-amber-300 bg-amber-50 text-amber-800"}`}>Pending</span>
            <span className={`rounded-full px-2.5 py-1 ${dark ? "bg-emerald-400/15 text-emerald-200 border border-emerald-400/30" : "border border-emerald-300 bg-emerald-50 text-emerald-800"}`}>Completed</span>
            <span className={`rounded-full px-2.5 py-1 ${dark ? "bg-rose-400/15 text-rose-200 border border-rose-400/30" : "border border-rose-300 bg-rose-50 text-rose-800"}`}>Cancelled</span>
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${dark ? "border border-teal-400/30 bg-teal-400/10 text-teal-200" : "border border-teal-300 bg-teal-50 text-teal-800"}`}>
              <span className="h-2 w-2 rounded-full bg-teal-400" />
              Available
            </span>
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${dark ? "border border-slate-600 bg-slate-800 text-slate-400" : "border border-slate-300 bg-slate-100 text-slate-500"}`}>
              <span className="h-2 w-2 rounded-sm" style={{ background: dark ? "repeating-linear-gradient(45deg,#475569,#475569 2px,transparent 2px,transparent 6px)" : "repeating-linear-gradient(45deg,#94a3b8,#94a3b8 2px,transparent 2px,transparent 6px)" }} />
              Not Available
            </span>
          </div>
        )}
      </div>
      <div className="space-y-3 md:hidden">
        {days.map((day) => {
          const dayAppointments = appointments.filter((appointment) => sameDay(appointment.scheduledAt, day));
          const dayAvailable = availabilityWindow.days.includes(day.getDay());

          return (
            <section key={day.toISOString()} className={`rounded-xl border p-3 ${dark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{formatWeekday(day)} · {formatMonthDay(day)}</p>
                  <p className={`text-[10px] font-bold uppercase ${dayAvailable ? "text-emerald-400" : "text-rose-400"}`}>
                    {dayAvailable ? "Available" : "Not Available"}
                  </p>
                </div>
                {dayAppointments.length ? (
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${dark ? "bg-white/10 text-slate-100" : "bg-slate-200 text-slate-700"}`}>
                    {dayAppointments.length} items
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {dayAppointments.length ? (
                  dayAppointments.map((appointment) => (
                    <AppointmentBlock key={appointment.id} appointment={appointment} editable={editable} compact onSelect={(appt, rect) => setSelectedEntry({ appointment: appt, rect })} tone={tone} />
                  ))
                ) : (
                  <p className={`rounded-lg border border-dashed p-3 text-xs font-semibold ${dark ? "border-slate-800 text-slate-500" : "border-slate-300 text-slate-500"}`}>
                    {dayAvailable ? "No appointments scheduled." : "Doctor not available on this day."}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="hidden md:block">
        {viewMode === "month" ? (
          <div className={`max-h-[620px] overflow-auto rounded-lg border transition-all duration-300 ${
            dark ? "border-slate-800 bg-slate-800" : "border-slate-200 bg-slate-200"
          }`}>
            <div className="grid min-w-[920px] grid-cols-7 gap-px">
              {days.map((day) => {
                const dayAppointments = appointments.filter((appointment) => sameDay(appointment.scheduledAt, day));
                const dayAvailable = availabilityWindow.days.includes(day.getDay());
                const dayOverflow = dayAppointments.length > 3;
                const visibleDayAppts = dayAppointments.slice(0, 3);

                const unavailableStyle: React.CSSProperties = !dayAvailable ? {
                  backgroundImage: dark
                    ? "repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(71,85,105,0.15) 6px,rgba(71,85,105,0.15) 12px)"
                    : "repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(148,163,184,0.18) 6px,rgba(148,163,184,0.18) 12px)",
                } : {};

                return (
                  <div
                    key={day.toISOString()}
                    onDragOver={(event) => {
                      if (editable && dayAvailable) {
                        event.preventDefault();
                      }
                    }}
                    onDrop={(event) => {
                      if (!editable || !onReschedule || !dayAvailable) {
                        return;
                      }

                      const appointmentId = event.dataTransfer.getData("text/plain");
                      const appointment = appointments.find((item) => item.id === appointmentId);
                      if (appointment) {
                        onReschedule(appointmentId, moveAppointmentToDay(appointment.scheduledAt, day));
                      }
                    }}
                    className={`min-h-36 p-2 transition-colors ${
                      dayAvailable
                        ? dark ? "bg-slate-950 hover:bg-slate-900/60" : "bg-white hover:bg-teal-50/30"
                        : dark ? "bg-slate-900/60" : "bg-slate-50"
                    }`}
                    style={unavailableStyle}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className={`text-xs font-black ${dark ? "text-white" : "text-slate-900"}`}>{formatMonthDay(day)}</p>
                        <p className={`text-[10px] font-bold uppercase ${
                          dayAvailable
                            ? dark ? "text-teal-400/70" : "text-teal-600/70"
                            : dark ? "text-rose-400/80" : "text-rose-600/80"
                        }`}>
                          {dayAvailable ? formatWeekday(day) : "Not Available"}
                        </p>
                      </div>
                      {dayAppointments.length > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          dark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>{dayAppointments.length}</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {visibleDayAppts.map((appointment) => (
                        <AppointmentBlock key={appointment.id} appointment={appointment} editable={editable} compact onSelect={(appt, rect) => setSelectedEntry({ appointment: appt, rect })} tone={tone} />
                      ))}
                      {dayOverflow && (
                        <button
                          type="button"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setSelectedEntry({ appointment: dayAppointments[3], rect });
                          }}
                          className={`mt-0.5 w-full rounded-md px-2 py-1 text-[10px] font-black text-center transition ${
                            dark ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                          }`}
                        >
                          +{dayAppointments.length - 3} more
                        </button>
                      )}
                      {!dayAvailable && dayAppointments.length === 0 && (
                        <p className={`text-[9px] font-black uppercase tracking-wider mt-1 ${dark ? "text-slate-600" : "text-slate-400"}`}>Not Available</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`overflow-x-auto rounded-lg border transition-all duration-300 ${dark ? "border-slate-800" : "border-slate-200"}`}>
            <div style={{ minWidth: `${gridMinWidth}px` }}>

              {/* ── Sticky day-header row (does NOT scroll vertically) ── */}
              <div
                className={`sticky top-0 z-20 grid gap-px ${dark ? "bg-slate-800" : "bg-slate-200"}`}
                style={{ gridTemplateColumns: `72px repeat(${days.length}, ${columnMinWidth})` }}
              >
                {/* Corner cell */}
                <div className={`p-3 ${dark ? "bg-slate-950" : "bg-slate-50"}`} />
                {days.map((day) => (
                  <div key={day.toISOString()} className={`p-3 ${dark ? "bg-slate-950" : "bg-slate-50"}`}>
                    <p className="text-xs font-black">{formatWeekday(day)}</p>
                    <p className={`text-xs font-semibold ${dark ? "text-slate-400" : "text-slate-500"}`}>
                      {formatMonthDay(day)}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── Scrollable time-body (vertical scroll only) ── */}
              <div
                className={`max-h-[556px] overflow-y-auto grid gap-px ${dark ? "bg-slate-800" : "bg-slate-200"}`}
                style={{ gridTemplateColumns: `72px repeat(${days.length}, ${columnMinWidth})` }}
              >
                {hours.map((hour) => (
                  <Fragment key={hour}>
                    <div
                      key={`time-${hour}`}
                      className={`p-3 text-xs font-black ${dark ? "bg-slate-950 text-slate-400" : "bg-slate-50 text-slate-500"}`}
                    >
                      {`${hour.toString().padStart(2, "0")}:00`}
                    </div>
                    {days.map((day) => {
                      const slot = setTime(day, hour);
                      const slotAppointments = appointments.filter((appointment) => sameSlot(appointment.scheduledAt, slot));
                      const slotMinutes = hour * 60;
                      const slotAvailable = (
                        availabilityWindow.days.includes(slot.getDay()) &&
                        slotMinutes >= availabilityWindow.startMinutes &&
                        slotMinutes < availabilityWindow.endMinutes
                      );

                      const MAX_VISIBLE = viewMode === "day" ? 4 : 3;
                      const visibleAppts = slotAppointments.slice(0, MAX_VISIBLE);
                      const overflowCount = slotAppointments.length - MAX_VISIBLE;

                      const unavailableSlotStyle: React.CSSProperties = !slotAvailable ? {
                        backgroundImage: dark
                          ? "repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(51,65,85,0.25) 8px,rgba(51,65,85,0.25) 16px)"
                          : "repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(148,163,184,0.14) 8px,rgba(148,163,184,0.14) 16px)",
                      } : {};

                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          onDragOver={(event) => {
                            if (editable && slotAvailable) {
                              event.preventDefault();
                            }
                          }}
                          onDrop={(event) => {
                            if (!editable || !onReschedule || !slotAvailable) {
                              return;
                            }

                            const appointmentId = event.dataTransfer.getData("text/plain");
                            if (appointmentId) {
                              onReschedule(appointmentId, toLocalDateTimeValue(slot));
                            }
                          }}
                          className={`relative min-h-[70px] p-1 transition-colors ${
                            slotAvailable
                              ? dark
                                ? "bg-slate-950 hover:bg-slate-900/50"
                                : "bg-white hover:bg-teal-50/20"
                              : dark
                                ? "bg-slate-900/70"
                                : "bg-slate-50/80"
                          } ${!slotAvailable && !editable ? "cursor-not-allowed" : ""}`}
                          style={unavailableSlotStyle}
                        >
                          {/* Prominent Not Available label when doctor is off-duty and slot is empty */}
                          {!slotAvailable && slotAppointments.length === 0 && (
                            <div className="flex h-full min-h-[58px] w-full items-center justify-center p-1 select-none pointer-events-none">
                              <div className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider border shadow-2xs ${
                                dark
                                  ? "bg-slate-800/90 text-slate-400 border-slate-700/70"
                                  : "bg-slate-100/95 text-slate-500 border-slate-200"
                              }`}>
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                                <span>Not Available</span>
                              </div>
                            </div>
                          )}

                          {/* Available empty-slot hover hint */}
                          {slotAvailable && slotAppointments.length === 0 && editable && (
                            <span className={`pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-black uppercase tracking-wider opacity-0 transition-opacity hover:opacity-100 ${
                              dark ? "text-teal-500/40" : "text-teal-600/30"
                            } group-hover:opacity-100`} />
                          )}

                          {/* Appointments: Stacked horizontally side-by-side with partial preview (Google Calendar style) */}
                          {slotAppointments.length > 0 && (
                            <div className="flex flex-row items-stretch gap-1.5 h-full min-h-[58px] w-full overflow-hidden">
                              {visibleAppts.map((appointment) => (
                                <div key={appointment.id} className="flex-1 min-w-0 h-full">
                                  <AppointmentBlock
                                    appointment={appointment}
                                    editable={editable}
                                    compact={slotAppointments.length > 1}
                                    onSelect={(appt, rect) => setSelectedEntry({ appointment: appt, rect })}
                                    tone={tone}
                                  />
                                </div>
                              ))}
                              {overflowCount > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setSelectedEntry({ appointment: slotAppointments[MAX_VISIBLE], rect });
                                  }}
                                  className={`shrink-0 w-8 flex flex-col items-center justify-center rounded-md border text-[10px] font-black transition ${
                                    dark
                                      ? "border-slate-700 bg-slate-800/90 text-slate-200 hover:bg-slate-700"
                                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  }`}
                                  title={`${overflowCount} more appointment(s). Click to view.`}
                                >
                                  +{overflowCount}
                                </button>
                              )}
                            </div>
                          )}

                          {/* If an appointment is scheduled outside doctor availability, display an indicator */}
                          {!slotAvailable && slotAppointments.length > 0 && (
                            <span className={`absolute -top-1 right-1 z-10 rounded px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider ${
                              dark ? "bg-rose-500/30 text-rose-200 border border-rose-500/40" : "bg-rose-100 text-rose-800 border border-rose-300"
                            }`}>
                              Off Hours
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>

            </div>
          </div>
        )}
      </div>
      {!stage && appointments.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {appointments.slice(0, 4).map((appointment) => (
            <p key={appointment.id} className={dark ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-slate-500"}>
              {appointment.title}: {formatDateTime(appointment.scheduledAt)}
            </p>
          ))}
        </div>
      ) : null}

      {/* Anchored popover */}
      {selectedEntry && (
        <AppointmentActionPopup
          appointment={selectedEntry.appointment}
          anchorRect={selectedEntry.rect}
          onClose={() => setSelectedEntry(null)}
          onViewPatient={onViewPatient}
          onConfirmAppointment={onConfirmAppointment}
          onCancelAppointment={onCancelAppointment}
          onCompleteConsultation={onCompleteConsultation}
          onStartConsultation={onStartConsultation}
          onFollowUpConsultation={onFollowUpConsultation}
          tone={tone}
        />
      )}
    </section>
  );
}
