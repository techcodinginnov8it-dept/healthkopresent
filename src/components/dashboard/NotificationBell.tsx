"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/dashboard/format";
import type { DashboardNotification, DashboardRole } from "@/lib/dashboard/types";

function BellIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const KIND_META: Record<string, { label: string; dot: string; bg: string; border: string; text: string }> = {
  appointment: {
    label: "Appointment",
    dot: "bg-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    text: "text-amber-300",
  },
  consultation: {
    label: "Consultation",
    dot: "bg-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/30",
    text: "text-sky-300",
  },
  message: {
    label: "Message",
    dot: "bg-violet-400",
    bg: "bg-violet-400/10",
    border: "border-violet-400/30",
    text: "text-violet-300",
  },
  prescription: {
    label: "Prescription",
    dot: "bg-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    text: "text-emerald-300",
  },
  system: {
    label: "System",
    dot: "bg-slate-400",
    bg: "bg-slate-400/10",
    border: "border-slate-600",
    text: "text-slate-400",
  },
};

function getKindMeta(kind?: string) {
  return KIND_META[kind ?? "system"] ?? KIND_META.system;
}

function NotificationItem({
  item,
  isDark,
  role,
  onNotificationClick,
  onViewAppointments,
}: {
  item: DashboardNotification;
  isDark: boolean;
  role: DashboardRole;
  onNotificationClick?: (n: DashboardNotification) => void;
  onViewAppointments?: () => void;
}) {
  const meta = getKindMeta(item.kind);
  const isBookingRequest =
    item.kind === "appointment" && !!item.appointmentId;

  return (
    <article
      className={`rounded-lg p-3 transition-colors ${
        isDark ? "hover:bg-slate-900" : "hover:bg-slate-50"
      }`}
    >
      {/* Kind badge + unread dot */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
            isDark
              ? `${meta.bg} ${meta.border} ${meta.text}`
              : "bg-slate-100 border-slate-200 text-slate-500"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        {!item.readAt && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-brand-red"
            aria-label="Unread"
          />
        )}
      </div>

      <p className={`text-sm font-black leading-snug ${isDark ? "text-white" : "text-slate-900"}`}>
        {item.title}
      </p>
      <p className={`mt-0.5 line-clamp-2 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        {item.body}
      </p>
      <p className={`mt-1.5 text-[10px] font-bold ${isDark ? "text-slate-600" : "text-slate-400"}`}>
        {formatDateTime(item.createdAt)}
      </p>

      {/* Clickable CTA for booking notifications */}
      {isBookingRequest && (
        role === "doctor" ? (
          /* Doctor: view patient data & confirm/reject */
          onNotificationClick && (
            <button
              type="button"
              onClick={() => onNotificationClick(item)}
              className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition active:scale-[0.97] ${
                isDark
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                  : "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              View Patient &amp; Confirm / Reject
            </button>
          )
        ) : (
          /* Patient: link to appointments section */
          <button
            type="button"
            onClick={() => onViewAppointments?.()}
            className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition active:scale-[0.97] ${
              isDark
                ? "border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
                : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            View My Appointments
          </button>
        )
      )}
    </article>
  );
}

export function NotificationBell({
  role,
  notifications,
  unreadCount,
  onMarkAllRead,
  onOpenNotifications,
  onNotificationClick,
  onViewAppointments,
  tone = "light",
}: {
  role: DashboardRole;
  notifications: DashboardNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onOpenNotifications: () => void;
  onNotificationClick?: (notification: DashboardNotification) => void;
  onViewAppointments?: () => void;
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const isDark = tone === "dark";
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Booking requests at top (unread first, then read), then rest sorted by date
  const sorted = [...notifications].sort((a, b) => {
    const aIsBooking = a.kind === "appointment" && !!a.appointmentId;
    const bIsBooking = b.kind === "appointment" && !!b.appointmentId;
    const aPending = aIsBooking && !a.readAt;
    const bPending = bIsBooking && !b.readAt;
    // Unread bookings first
    if (aPending && !bPending) return -1;
    if (!aPending && bPending) return 1;
    // Then read bookings above non-bookings
    if (aIsBooking && !bIsBooking) return -1;
    if (!aIsBooking && bIsBooking) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const pendingBookingCount = notifications.filter(
    (n) => n.kind === "appointment" && !!n.appointmentId && !n.readAt
  ).length;
  const totalBookingCount = notifications.filter(
    (n) => n.kind === "appointment" && !!n.appointmentId
  ).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
          isDark
            ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs"
        }`}
        aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border shadow-2xl ${
            isDark
              ? "border-slate-800 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-950"
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">
                Notifications
              </p>
              <p className="mt-0.5 text-sm font-black">
                {pendingBookingCount > 0
                  ? `${pendingBookingCount} pending · ${totalBookingCount} booking request${totalBookingCount > 1 ? "s" : ""}`
                  : totalBookingCount > 0
                  ? `${totalBookingCount} booking request${totalBookingCount > 1 ? "s" : ""}`
                  : unreadCount
                  ? `${unreadCount} unread`
                  : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={onMarkAllRead}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase transition ${
                isDark
                  ? "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Mark Read
            </button>
          </div>

          {/* List */}
          <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-800/50 p-1.5 space-y-0.5">
            {sorted.length ? (
              sorted.slice(0, 10).map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  isDark={isDark}
                  role={role}
                  onNotificationClick={(n) => {
                    setOpen(false);
                    onNotificationClick?.(n);
                  }}
                  onViewAppointments={() => {
                    setOpen(false);
                    onViewAppointments?.();
                  }}
                />
              ))
            ) : (
              <div className={`p-5 text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                No alerts yet.
              </div>
            )}
          </div>

          {/* Footer */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenNotifications();
            }}
            className={`w-full border-t px-4 py-3 text-xs font-black transition ${
              isDark
                ? "border-slate-800 text-brand-teal hover:bg-slate-900"
                : "border-slate-200 text-brand-teal hover:bg-slate-50"
            }`}
          >
            View All Notifications →
          </button>
        </div>
      )}
    </div>
  );
}
