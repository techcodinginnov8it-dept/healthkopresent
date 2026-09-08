"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/dashboard/format";
import { parseAvailability } from "@/lib/scheduling";

export type CalendarViewMode = "day" | "week" | "month";

type CalendarAppointment = {
  id: string;
  title: string;
  subtitle: string;
  scheduledAt: Date | string;
  status: string;
  reason?: string | null;
};

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
      ? "border-sky-400/30 bg-sky-500/15 text-sky-100 hover:border-sky-400/60 hover:bg-sky-500/25"
      : "border-sky-300 bg-sky-50/90 text-sky-950 shadow-2xs hover:border-sky-400 hover:bg-sky-100"
    : pending
      ? dark
        ? "border-amber-400/30 bg-amber-500/15 text-amber-100 hover:border-amber-400/60 hover:bg-amber-500/25"
        : "border-amber-300 bg-amber-50/90 text-amber-950 shadow-2xs hover:border-amber-400 hover:bg-amber-100"
      : completed
        ? dark
          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:border-emerald-400/60 hover:bg-emerald-500/25"
          : "border-emerald-300 bg-emerald-50/90 text-emerald-950 shadow-2xs hover:border-emerald-400 hover:bg-emerald-100"
        : cancelled
          ? dark
            ? "border-rose-400/30 bg-rose-500/15 text-rose-100 hover:border-rose-400/60 hover:bg-rose-500/25"
            : "border-rose-300 bg-rose-50/90 text-rose-950 shadow-2xs hover:border-rose-400 hover:bg-rose-100"
          : dark
            ? "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-750"
            : "border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200/70";

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

  return (
    <article
      draggable={editable && !completed && !cancelled}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", appointment.id)}
      onClick={(event) => {
        event.stopPropagation();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        onSelect(appointment, rect);
      }}
      className={`rounded-md border shadow-sm transition select-none ${
        compact ? "px-2 py-1.5 text-[10px]" : "px-2.5 py-2 text-xs"
      } ${statusColor} cursor-pointer active:scale-[0.98]`}
      title="Click to see actions"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="truncate font-black">{appointment.title}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.2 text-[9px] font-black uppercase border ${badgeColor}`}>
          {badgeLabel}
        </span>
      </div>
      {!compact && <p className={`mt-1 truncate font-semibold ${subtitleColor}`}>{appointment.subtitle}</p>}
      {compact && <p className={`mt-1 font-semibold ${subtitleColor}`}>{formatDateTime(appointment.scheduledAt)}</p>}
    </article>
  );
}

function AppointmentActionPopup({
  appointment,
  anchorRect,
  onClose,
  onConfirmAppointment,
  onCompleteConsultation,
  onStartConsultation,
  onFollowUpConsultation,
  tone = "light",
}: {
  appointment: CalendarAppointment;
  anchorRect: DOMRect;
  onClose: () => void;
  onConfirmAppointment?: (appointment: CalendarAppointment) => void;
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
  const POPOVER_WIDTH = 232;
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
  const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - 280));

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
        className={`overflow-hidden rounded-xl border shadow-2xl transition-all ${
          dark
            ? "border-slate-700/80 bg-slate-900 text-white ring-1 ring-white/5"
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

        {/* Header */}
        <div className={`border-b px-4 pb-3 pt-4 ${dark ? "border-slate-700/60" : "border-slate-100"}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Appointment</p>
          <p className={`mt-1 text-sm font-black leading-snug ${dark ? "text-white" : "text-slate-900"}`}>{appointment.title}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot}`} />
            <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
          </div>
          <p className={`mt-1 text-[10px] font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>{formatDateTime(appointment.scheduledAt)}</p>
        </div>

        {/* Actions */}
        <div className="p-2 space-y-0.5">
          {pending && (
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
  onConfirmAppointment,
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
  onConfirmAppointment?: (appointment: CalendarAppointment) => void;
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
  const availabilityWindow = parseAvailability(availability);
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
          </div>
        )}
      </div>
      <div className="space-y-3 md:hidden">
        {days.map((day) => {
          const dayAppointments = appointments.filter((appointment) => sameDay(appointment.scheduledAt, day));
          const dayAvailable = !availabilityWindow || availabilityWindow.days.includes(day.getDay());

          return (
            <section key={day.toISOString()} className={`rounded-xl border p-3 ${dark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{formatWeekday(day)} · {formatMonthDay(day)}</p>
                  <p className={`text-[10px] font-bold uppercase ${dayAvailable ? "text-emerald-400" : "text-slate-400"}`}>
                    {dayAvailable ? "Available" : "Outside availability"}
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
                    No appointments scheduled.
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
                const dayAvailable = !availabilityWindow || availabilityWindow.days.includes(day.getDay());

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
                        ? dark ? "bg-slate-950" : "bg-white"
                        : dark ? "bg-slate-900/50" : "bg-slate-100"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className={`text-xs font-black ${dark ? "text-white" : "text-slate-900"}`}>{formatMonthDay(day)}</p>
                        <p className={`text-[10px] font-bold uppercase ${dark ? "text-slate-500" : "text-slate-400"}`}>{formatWeekday(day)}</p>
                      </div>
                      {dayAppointments.length ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          dark ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>{dayAppointments.length}</span>
                      ) : null}
                    </div>
                    <div className="max-h-24 space-y-1.5 overflow-y-auto pr-1">
                      {dayAppointments.map((appointment) => (
                        <AppointmentBlock key={appointment.id} appointment={appointment} editable={editable} compact onSelect={(appt, rect) => setSelectedEntry({ appointment: appt, rect })} tone={tone} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-h-[620px] overflow-x-auto overflow-y-auto rounded-lg transition-all duration-300">
            <div
              className={`grid gap-px overflow-hidden rounded-lg border ${dark ? "border-slate-800 bg-slate-800" : "border-slate-200 bg-slate-200"}`}
              style={{
                gridTemplateColumns: `72px repeat(${days.length}, ${columnMinWidth})`,
                minWidth: `${gridMinWidth}px`,
              }}
            >
              <div className={dark ? "bg-slate-950 p-3" : "bg-slate-50 p-3"} />
              {days.map((day) => (
                <div key={day.toISOString()} className={dark ? "bg-slate-950 p-3" : "bg-slate-50 p-3"}>
                  <p className="text-xs font-black">{formatWeekday(day)}</p>
                  <p className={dark ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-slate-500"}>
                    {formatMonthDay(day)}
                  </p>
                </div>
              ))}
              {hours.map((hour) => (
                <Fragment key={hour}>
                  <div key={`time-${hour}`} className={dark ? "bg-slate-950 p-3 text-xs font-black text-slate-400" : "bg-slate-50 p-3 text-xs font-black text-slate-500"}>
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </div>
                  {days.map((day) => {
                    const slot = setTime(day, hour);
                    const slotAppointments = appointments.filter((appointment) => sameSlot(appointment.scheduledAt, slot));
                    const slotMinutes = hour * 60;
                    const slotAvailable = !availabilityWindow || (
                      availabilityWindow.days.includes(slot.getDay()) &&
                      slotMinutes >= availabilityWindow.startMinutes &&
                      slotMinutes < availabilityWindow.endMinutes
                    );

                    return (
                      <div
                        key={`${day.toISOString()}-${hour}`}
                        onDragOver={(event) => {
                          if (editable) {
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
                        className={`${stage ? "min-h-20" : "min-h-24"} p-2 ${slotAvailable ? (dark ? "bg-slate-950" : "bg-white") : dark ? "bg-slate-900/50" : "bg-slate-100"}`}
                      >
                        <div className={stage ? "flex max-h-28 flex-col gap-1.5 overflow-y-auto pr-1" : "space-y-2"}>
                          {slotAppointments.map((appointment) => {
                            return stage ? (
                              <AppointmentBlock key={appointment.id} appointment={appointment} editable={editable} onSelect={(appt, rect) => setSelectedEntry({ appointment: appt, rect })} tone={tone} />
                            ) : (
                              <article
                                key={appointment.id}
                                draggable={editable}
                                onDragStart={(event) => event.dataTransfer.setData("text/plain", appointment.id)}
                                className={`rounded-lg border-l-4 border-brand-teal p-2 text-xs shadow-sm ${
                                  dark ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900"
                                } ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                                title={editable ? "Drag to another calendar slot" : undefined}
                              >
                                <p className="font-black">{appointment.title}</p>
                                <p className={dark ? "mt-1 font-semibold text-slate-400" : "mt-1 font-semibold text-slate-500"}>{appointment.subtitle}</p>
                                <p className="mt-2 font-black uppercase text-brand-teal">{appointment.status}</p>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              ))}
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
          onConfirmAppointment={onConfirmAppointment}
          onCompleteConsultation={onCompleteConsultation}
          onStartConsultation={onStartConsultation}
          onFollowUpConsultation={onFollowUpConsultation}
          tone={tone}
        />
      )}
    </section>
  );
}
