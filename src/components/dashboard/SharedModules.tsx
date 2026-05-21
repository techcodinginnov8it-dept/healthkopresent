"use client";

import { useState } from "react";
import type { ChatMessage, DashboardRole } from "@/lib/dashboard/types";
import { formatDate, formatDateTime } from "@/lib/dashboard/format";

export function StatGrid({
  stats,
  tone = "light",
}: {
  stats: { label: string; value: string | number; helper: string }[];
  tone?: "light" | "dark";
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-xl border p-5 ${
            tone === "dark" ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-950"
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">{stat.label}</p>
          <p className="mt-3 font-display text-3xl font-black">{stat.value}</p>
          <p className={`mt-1 text-xs font-semibold ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>{stat.helper}</p>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <p className="text-sm font-black text-slate-800">{title}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{body}</p>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
      ))}
    </div>
  );
}

export function AppointmentCard({
  title,
  subtitle,
  scheduledAt,
  status,
  reason,
  tone = "light",
  actions,
}: {
  title: string;
  subtitle: string;
  scheduledAt: Date | string;
  status: string;
  reason?: string | null;
  tone?: "light" | "dark";
  actions?: React.ReactNode;
}) {
  return (
    <article
      className={`rounded-xl border p-4 ${
        tone === "dark" ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-950"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black">{title}</h3>
            <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-black uppercase text-brand-teal">
              {status}
            </span>
          </div>
          <p className={`mt-1 text-xs font-bold ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</p>
          {reason && <p className={`mt-2 text-xs leading-relaxed ${tone === "dark" ? "text-slate-300" : "text-slate-600"}`}>{reason}</p>}
        </div>
        <div className="shrink-0 text-left md:text-right">
          <p className={`text-xs font-black ${tone === "dark" ? "text-slate-300" : "text-slate-700"}`}>{formatDateTime(scheduledAt)}</p>
          {actions && <div className="mt-3 flex flex-wrap gap-2 md:justify-end">{actions}</div>}
        </div>
      </div>
    </article>
  );
}

export function ChatPanel({
  role,
  messages,
  onSend,
  tone = "dark",
}: {
  role: DashboardRole;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  tone?: "light" | "dark";
}) {
  const [draft, setDraft] = useState("");

  return (
    <section className={`flex min-h-[360px] flex-col rounded-xl border ${tone === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
      <header className={`border-b px-4 py-3 ${tone === "dark" ? "border-slate-800" : "border-slate-200"}`}>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal">Messages</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length ? (
          messages.map((message) => {
            const mine = message.sender === role;

            return (
              <div key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <span className="text-[10px] font-bold uppercase text-slate-500">{mine ? "You" : message.sender} · {message.time}</span>
                <p className={`mt-1 max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${mine ? "bg-brand-teal text-white" : tone === "dark" ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-700"}`}>
                  {message.text}
                </p>
              </div>
            );
          })
        ) : (
          <EmptyState title="No messages yet" body="Start the conversation from either dashboard." />
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft);
          setDraft("");
        }}
        className={`flex gap-2 border-t p-3 ${tone === "dark" ? "border-slate-800" : "border-slate-200"}`}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type secure message..."
          className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-teal ${tone === "dark" ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}
        />
        <button type="submit" className="rounded-lg bg-brand-teal px-4 py-2 text-xs font-black text-white">
          Send
        </button>
      </form>
    </section>
  );
}

export function LiveConsultationPanel({
  role,
  counterpartName,
  appointmentTime,
  status,
  isCameraOn,
  isMicOn,
  onToggleCamera,
  onToggleMic,
  onEnd,
  chat,
  documentation,
}: {
  role: DashboardRole;
  counterpartName: string;
  appointmentTime: Date | string;
  status: "idle" | "waiting" | "connected" | "ended";
  isCameraOn: boolean;
  isMicOn: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEnd: () => void;
  chat: React.ReactNode;
  documentation?: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <section className="rounded-xl border border-slate-800 bg-slate-950 text-white xl:col-span-7">
        <header className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Live Consultation</p>
            <h2 className="mt-1 text-lg font-black">{counterpartName}</h2>
            <p className="text-xs font-semibold text-slate-400">{formatDateTime(appointmentTime)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${status === "connected" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
            {status === "connected" ? "Connected" : "Waiting room"}
          </span>
        </header>
        <div className="grid min-h-[420px] gap-4 p-4 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.28),_transparent_45%)]" />
            <div className="relative flex h-full items-center justify-center p-6 text-center">
              <div>
                <div className="mx-auto h-16 w-16 rounded-full bg-brand-teal/20" />
                <p className="mt-4 text-sm font-black">{counterpartName}</p>
                <p className="mt-1 text-xs text-slate-400">{role === "doctor" ? "Patient stream" : "Doctor stream"}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="relative flex h-full items-center justify-center p-6 text-center">
              <div>
                <div className={`mx-auto h-16 w-16 rounded-full ${isCameraOn ? "bg-slate-700" : "bg-brand-red/30"}`} />
                <p className="mt-4 text-sm font-black">Your stream</p>
                <p className="mt-1 text-xs text-slate-400">{isCameraOn ? "Camera active" : "Camera disabled"}</p>
              </div>
            </div>
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-800 p-4">
          <button type="button" onClick={onToggleCamera} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-black text-white">
            {isCameraOn ? "Camera On" : "Camera Off"}
          </button>
          <button type="button" onClick={onToggleMic} className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-black text-white">
            {isMicOn ? "Mic On" : "Mic Off"}
          </button>
          <button type="button" onClick={onEnd} className="rounded-lg bg-brand-red px-4 py-2 text-xs font-black text-white">
            End Session
          </button>
        </footer>
      </section>

      <div className="space-y-4 xl:col-span-5">
        {documentation}
        {chat}
      </div>
    </div>
  );
}

export function PrescriptionList({
  items,
  role,
}: {
  items: { id: string; prescription: string | null; reason?: string | null; scheduledAt: Date | string; owner: string }[];
  role: DashboardRole;
}) {
  const active = items.filter((item) => item.prescription);

  return active.length ? (
    <div className="grid gap-4 md:grid-cols-2">
      {active.map((item) => (
        <article key={item.id} className="rounded-xl border border-brand-red/20 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-red">Prescription</p>
          <h3 className="mt-2 text-sm font-black text-slate-950">{item.prescription}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">{role === "doctor" ? "Patient" : "Doctor"}: {item.owner}</p>
          <p className="mt-3 text-xs text-slate-500">{formatDate(item.scheduledAt)} · {item.reason || "Clinical encounter"}</p>
          <button type="button" className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
            Download PDF
          </button>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState title="No active prescriptions" body="Prescriptions issued during completed visits appear here." />
  );
}
