"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatAttachment, ChatMessage, DashboardRole } from "@/lib/dashboard/types";
import { formatDate, formatDateTime } from "@/lib/dashboard/format";
import { downloadPrescriptionPdf } from "@/lib/prescription-pdf";

function VideoControlIcon({ off = false }: { off?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 13 5 3V8l-5 3" />
      <rect width="14" height="10" x="2" y="7" rx="2" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function MicControlIcon({ off = false }: { off?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function PhoneDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 rotate-[135deg]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z" />
    </svg>
  );
}

function ScreenShareIcon({ off = false }: { off?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="m9 9 3 3 3-3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function formatCallDuration(startedAt?: number | null) {
  if (!startedAt) {
    return "00:00";
  }

  const totalSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useCallDuration(startedAt?: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  return startedAt ? formatCallDuration(now - startedAt) : "00:00";
}

export function StatGrid({
  stats,
  tone = "light",
}: {
  stats: { label: string; value: string | number; helper: string }[];
  tone?: "light" | "dark";
}) {
  const gridColumns = stats.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3";

  return (
    <div className={`grid gap-4 ${gridColumns}`}>
      {stats.map((stat, idx) => {
        const accents = [
          "from-brand-teal/10 via-white to-white border-brand-teal/20 text-brand-teal",
          "from-emerald-500/10 via-white to-white border-emerald-500/20 text-emerald-600",
          "from-blue-500/10 via-white to-white border-blue-500/20 text-blue-600",
          "from-purple-500/10 via-white to-white border-purple-500/20 text-purple-600",
        ];
        const accent = accents[idx % accents.length];

        return (
          <div
            key={stat.label}
            className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-md ${
              tone === "dark"
                ? "border-slate-800 bg-slate-900/90 text-white hover:border-slate-700"
                : `bg-gradient-to-br ${accent} shadow-xs`
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">{stat.label}</p>
              <span className="h-2 w-2 rounded-full bg-brand-teal/40 group-hover:bg-brand-teal transition-colors" />
            </div>
            <p className="mt-2 font-display text-3xl font-black tracking-tight">{stat.value}</p>
            <p className={`mt-1 text-xs font-medium leading-snug ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>{stat.helper}</p>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  tone = "light",
}: {
  title: string;
  body: string;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <div
      className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
        isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-300/80 bg-slate-50/70"
      }`}
    >
      <p className={`text-sm font-black ${isDark ? "text-slate-200" : "text-slate-800"}`}>{title}</p>
      <p className={`mt-1 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{body}</p>
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
      className={`group rounded-2xl border p-4 transition-all duration-200 hover:shadow-md ${
        tone === "dark"
          ? "border-slate-800 bg-slate-900/80 text-white hover:border-slate-700"
          : "border-slate-200/80 bg-white text-slate-950 hover:border-slate-300"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black">{title}</h3>
            <AppointmentStatusBadge status={status} />
          </div>
          <p className="mt-1 text-xs font-bold tracking-wide text-brand-teal">{subtitle}</p>
          {reason && <p className={`mt-2 line-clamp-2 text-xs leading-relaxed ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>{reason}</p>}
        </div>
        <div className={`shrink-0 rounded-xl border px-3 py-2 text-center text-xs sm:text-right ${tone === "dark" ? "border-slate-800 bg-slate-800/60" : "border-slate-100 bg-slate-50"}`}>
          <p className={`font-black leading-tight ${tone === "dark" ? "text-slate-200" : "text-slate-800"}`}>{formatDateTime(scheduledAt)}</p>
        </div>
      </div>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const styles: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    COMPLETED: "bg-blue-50 text-blue-700 border-blue-200",
    CANCELLED: "bg-red-50 text-red-700 border-red-200",
  };
  const cls = styles[s] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

const SYSTEM_MESSAGE_TEXTS = new Set([
  "Secure room is staged. Start the consultation when you are ready.",
  "Waiting room opened. Complete your device checks while the doctor starts the consultation.",
  "Secure room opened. Waiting for the patient to join.",
  "Secure WebRTC room access authorized.",
  "Participant joined the live consultation room.",
  "The consultation was ended.",
]);

function isSystemChatMessage(message: ChatMessage) {
  return message.kind === "system" || (!message.kind && SYSTEM_MESSAGE_TEXTS.has(message.text));
}

function SystemChatMessage({ message, tone }: { message: ChatMessage; tone: "light" | "dark" }) {
  return (
    <div className="flex justify-center px-2">
      <div
        className={`max-w-[90%] rounded-full border px-3 py-1.5 text-center text-[11px] font-bold ${
          tone === "dark"
            ? "border-slate-700 bg-slate-950/80 text-slate-300"
            : "border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        <span>{message.text}</span>
        <span className="ml-2 text-[10px] uppercase opacity-70">{message.time}</span>
      </div>
    </div>
  );
}

function ConversationChatMessage({ message, mine, tone }: { message: ChatMessage; mine: boolean; tone: "light" | "dark" }) {
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="text-[10px] font-bold uppercase text-slate-500">{mine ? "You" : message.sender} · {message.time}</span>
      <p className={`mt-1 max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${mine ? "bg-brand-teal text-white" : tone === "dark" ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-700"}`}>
        {message.text}
        {message.attachment && (
          <a
            href={message.attachment.dataUrl}
            download={message.attachment.name}
            className="mt-2 block rounded-lg bg-white/10 px-2 py-1 font-black underline"
          >
            {message.attachment.name}
          </a>
        )}
      </p>
    </div>
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
  onSend: (text: string, attachment?: ChatAttachment) => void;
  tone?: "light" | "dark";
}) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>();
  const visibleMessages = useMemo(() => {
    const seen = new Set<string>();

    return messages.filter((message) => {
      if (seen.has(message.id)) {
        return false;
      }

      seen.add(message.id);
      return true;
    });
  }, [messages]);
  const hasConversationMessages = visibleMessages.some((message) => !isSystemChatMessage(message));

  const handleFile = (file?: File) => {
    if (!file) {
      setAttachment(undefined);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        dataUrl: typeof reader.result === "string" ? reader.result : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className={`flex min-h-[360px] flex-col rounded-xl border ${tone === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
      <header className={`border-b px-4 py-3 ${tone === "dark" ? "border-slate-800" : "border-slate-200"}`}>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal">Messages</p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {visibleMessages.length ? (
          visibleMessages.map((message) => {
            if (isSystemChatMessage(message)) {
              return <SystemChatMessage key={message.id} message={message} tone={tone} />;
            }

            const mine = message.sender === role;

            return <ConversationChatMessage key={message.id} message={message} mine={mine} tone={tone} />;
          })
        ) : (
          <EmptyState tone={tone} title="No messages yet" body="Start the conversation from either dashboard." />
        )}
        {visibleMessages.length > 0 && !hasConversationMessages && (
          <p className={`pt-1 text-center text-xs font-semibold ${tone === "dark" ? "text-slate-500" : "text-slate-400"}`}>
            No conversation messages yet.
          </p>
        )}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft, attachment);
          setDraft("");
          setAttachment(undefined);
        }}
        className={`flex flex-col gap-2 border-t p-3 ${tone === "dark" ? "border-slate-800" : "border-slate-200"}`}
      >
        {attachment && <p className="text-xs font-bold text-brand-teal">Attached: {attachment.name}</p>}
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type secure message..."
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-teal ${tone === "dark" ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900"}`}
          />
          <label className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-black ${tone === "dark" ? "border-slate-800 text-slate-200" : "border-slate-200 text-slate-700"}`}>
            File
            <input type="file" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>
          <button type="submit" className="rounded-lg bg-brand-teal px-4 py-2 text-xs font-black text-white">
            Send
          </button>
        </div>
      </form>
    </section>
  );
}

function VideoStream({ stream, muted, active }: { stream: MediaStream | null; muted?: boolean; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;

    const attemptPlay = async () => {
      try {
        await video.play();
      } catch {
        // If unmuted autoplay fails due to browser policy, mute temporarily to render video feed
        if (!muted) {
          video.muted = true;
          try {
            await video.play();
          } catch {
            // Silence inner error
          }
        }
      }
    };

    void attemptPlay();

    const handleUserInteraction = () => {
      if (!muted && video.muted) {
        video.muted = false;
        void video.play().catch(() => {});
      }
    };

    window.addEventListener("click", handleUserInteraction, { once: true });
    window.addEventListener("keydown", handleUserInteraction, { once: true });

    return () => {
      video.srcObject = null;
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
    };
  }, [muted, stream]);

  if (!stream) return null;

  const hasVideo = stream.getVideoTracks().length > 0;
  const hasAudio = stream.getAudioTracks().length > 0;
  const visualActive = active && hasVideo;

  if (!visualActive && !hasAudio) return null;

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={visualActive ? "absolute inset-0 h-full w-full rounded-xl object-cover" : "sr-only"}
    />
  );
}

function ConsultationVideoTile({
  stream,
  label,
  detail,
  active,
  cameraOn = true,
  micOn = true,
  muted = false,
  isCompact = false,
  className = "",
  tone = "teal",
}: {
  stream: MediaStream | null;
  label: string;
  detail: string;
  active: boolean;
  cameraOn?: boolean;
  micOn?: boolean;
  muted?: boolean;
  isCompact?: boolean;
  className?: string;
  tone?: "teal" | "slate";
}) {
  const ref = useRef<HTMLVideoElement>(null);

  // Track count state: forces re-render when video/audio tracks are added or removed
  // to the same MediaStream object (React won't re-render on mutable stream mutations).
  const [streamTracks, setStreamTracks] = useState<MediaStreamTrack[]>(
    () => stream?.getTracks() ?? []
  );

  useEffect(() => {
    if (!stream) {
      const timer = setTimeout(() => setStreamTracks([]), 0);
      return () => clearTimeout(timer);
    }

    const refresh = () => setStreamTracks(stream.getTracks());
    const timer = setTimeout(refresh, 0);

    stream.addEventListener("addtrack", refresh);
    stream.addEventListener("removetrack", refresh);
    return () => {
      clearTimeout(timer);
      stream.removeEventListener("addtrack", refresh);
      stream.removeEventListener("removetrack", refresh);
    };
  }, [stream]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;

    const attemptPlay = async () => {
      try {
        await video.play();
      } catch {
        if (!muted) {
          video.muted = true;
          try {
            await video.play();
          } catch {
            // Ignore fallback error
          }
        }
      }
    };

    void attemptPlay();

    const handleUserInteraction = () => {
      if (!muted && video.muted) {
        video.muted = false;
        void video.play().catch(() => {});
      }
    };

    window.addEventListener("click", handleUserInteraction, { once: true });
    window.addEventListener("keydown", handleUserInteraction, { once: true });

    return () => {
      video.srcObject = null;
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
    };
  }, [muted, stream]);

  const hasVideo = streamTracks.some((t) => t.kind === "video");
  const hasAudio = streamTracks.some((t) => t.kind === "audio");
  const showFeed = Boolean(stream && hasVideo);

  if (isCompact) {
    return (
      <div className={`relative h-full w-full overflow-hidden rounded-xl border border-white/20 bg-slate-950 shadow-2xl ${className}`}>
        {stream && showFeed ? (
          <video
            ref={ref}
            autoPlay
            playsInline
            muted={muted}
            className={`h-full w-full object-cover transition-opacity duration-500 ${active ? "opacity-100" : "opacity-35"}`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 p-2 text-center">
            <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-300">
              {label.substring(0, 2).toUpperCase()}
            </div>
            <p className="mt-1 text-[10px] font-bold text-slate-400">Camera Off</p>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent px-3 py-2">
          <span className="text-[11px] font-black tracking-wide text-white drop-shadow">You</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${cameraOn ? "bg-emerald-400 ring-2 ring-emerald-400/20" : "bg-rose-500"}`}
              title={cameraOn ? "Camera active" : "Camera off"}
            />
            <span
              className={`h-2 w-2 rounded-full ${micOn ? "bg-emerald-400 ring-2 ring-emerald-400/20" : "bg-rose-500"}`}
              title={micOn ? "Microphone active" : "Microphone muted"}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 ${className}`}>
      {stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={muted}
          className={
            showFeed
              ? `absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${active ? "opacity-100" : "opacity-35"}`
              : "sr-only"
          }
        />
      ) : null}
      <div
        className={`absolute inset-0 ${
          showFeed
            ? "bg-[linear-gradient(180deg,rgba(2,6,23,0.05)_0%,rgba(2,6,23,0.18)_48%,rgba(2,6,23,0.78)_100%)]"
            : tone === "teal"
              ? "bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.28),_transparent_45%)]"
              : "bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.22),_transparent_45%)]"
        }`}
      />
      <div className="relative flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Live feed</p>
            <h3 className="mt-1 truncate text-sm font-black text-white">{label}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-200/80">{detail}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                cameraOn
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                  : "bg-rose-500/15 text-rose-300 border border-rose-500/20"
              }`}
            >
              {cameraOn ? "Camera On" : "Camera Off"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${
                micOn
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                  : "bg-rose-500/15 text-rose-300 border border-rose-500/20"
              }`}
            >
              {micOn ? (
                <>
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                  <span>Mic On</span>
                </>
              ) : (
                <>
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75 20.25 20.25M9 9.75v2.25a3 3 0 0 0 5.25 2m-.25-6.25v-1.25a3 3 0 0 0-6 0v4.25m4.25 10.25H12V18.75m-6-6v-1.5m12 1.5v-1.5" />
                  </svg>
                  <span>Muted</span>
                </>
              )}
            </span>
          </div>
        </div>

        {showFeed ? null : (
          <div className="mt-auto flex flex-1 items-center justify-center p-4 text-center">
            <div>
              <div
                className={`mx-auto h-16 w-16 rounded-full ${
                  tone === "teal" ? "bg-brand-teal/20" : "bg-slate-700/70"
                }`}
              />
              <p className="mt-4 text-sm font-black text-white">{label}</p>
              <p className="mt-1 text-xs text-slate-400">{detail}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type MediaDeviceControlsProps = {
  devices?: MediaDeviceInfo[];
  cameraDeviceId?: string;
  microphoneDeviceId?: string;
  onCameraDeviceChange?: (deviceId: string) => void;
  onMicrophoneDeviceChange?: (deviceId: string) => void;
  onRefreshDevices?: () => void;
  deviceStatus?: {
    cameraAvailable: boolean;
    microphoneAvailable: boolean;
    permissionState: PermissionState | "unknown";
    message: string | null;
  };
};

function MediaDeviceControls({
  devices = [],
  cameraDeviceId = "",
  microphoneDeviceId = "",
  onCameraDeviceChange,
  onMicrophoneDeviceChange,
  onRefreshDevices,
  deviceStatus,
}: MediaDeviceControlsProps) {
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const microphones = devices.filter((device) => device.kind === "audioinput");

  return (
    <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="min-w-0 space-y-1 font-bold text-slate-300">
        Camera
        <select
          value={cameraDeviceId}
          onChange={(event) => onCameraDeviceChange?.(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-brand-teal"
        >
          <option value="">{cameras.length ? "Default camera" : "No camera detected"}</option>
          {cameras.map((device, index) => (
            <option key={device.deviceId || `camera-${index}`} value={device.deviceId}>
              {device.label || `Camera ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0 space-y-1 font-bold text-slate-300">
        Microphone
        <select
          value={microphoneDeviceId}
          onChange={(event) => onMicrophoneDeviceChange?.(event.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-brand-teal"
        >
          <option value="">{microphones.length ? "Default microphone" : "No microphone detected"}</option>
          {microphones.map((device, index) => (
            <option key={device.deviceId || `microphone-${index}`} value={device.deviceId}>
              {device.label || `Microphone ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onRefreshDevices}
        className="self-end rounded-md border border-white/10 px-3 py-2 text-[10px] font-black uppercase text-slate-200 transition hover:bg-white/10"
      >
        Recheck
      </button>
      {deviceStatus?.message && (
        <p className="text-[11px] font-semibold text-amber-100 sm:col-span-3">{deviceStatus.message}</p>
      )}
    </div>
  );
}

export function LiveConsultationPanel({
  role,
  counterpartName,
  appointmentTime,
  status,
  isCameraOn,
  isMicOn,
  isScreenSharing = false,
  counterpartCameraOn = true,
  counterpartMicOn = true,
  counterpartScreenSharing = false,
  connectedAt = null,
  onToggleCamera,
  onToggleMic,
  onToggleScreenShare,
  onEnd,
  chat,
  documentation,
  localStream = null,
  screenShareStream = null,
  remoteStream = null,
  connectionState = "new",
  mediaError = null,
  screenShareSupported = true,
  devices,
  cameraDeviceId,
  microphoneDeviceId,
  deviceStatus,
  onCameraDeviceChange,
  onMicrophoneDeviceChange,
  onRefreshDevices,
  tone = "light",
}: {
  role: DashboardRole;
  counterpartName: string;
  appointmentTime: Date | string;
  status: "idle" | "waiting" | "connected" | "ended";
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing?: boolean;
  counterpartCameraOn?: boolean;
  counterpartMicOn?: boolean;
  counterpartScreenSharing?: boolean;
  connectedAt?: number | null;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleScreenShare?: () => void;
  onEnd: () => void;
  chat: React.ReactNode;
  documentation?: React.ReactNode;
  localStream?: MediaStream | null;
  screenShareStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  connectionState?: RTCPeerConnectionState;
  mediaError?: string | null;
  screenShareSupported?: boolean;
  devices?: MediaDeviceInfo[];
  cameraDeviceId?: string;
  microphoneDeviceId?: string;
  deviceStatus?: MediaDeviceControlsProps["deviceStatus"];
  onCameraDeviceChange?: (deviceId: string) => void;
  onMicrophoneDeviceChange?: (deviceId: string) => void;
  onRefreshDevices?: () => void;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  const statusLabel = status === "connected" ? "Connected" : role === "doctor" ? "Waiting for Patient" : "Waiting room";
  const remoteVideoAvailable = Boolean(remoteStream?.getVideoTracks().length);
  const remoteVideoActive = remoteVideoAvailable && counterpartCameraOn;
  const connectionLabel =
    connectionState === "connected"
      ? "Media connected"
      : connectionState === "connecting"
        ? "Connecting media"
        : connectionState === "failed"
          ? "Media connection failed"
          : "Media ready";
  const callDuration = useCallDuration(connectedAt);

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <section className={`relative rounded-xl border transition-colors xl:col-span-7 ${
        isDark ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"
      }`}>
        <header className={`flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between ${
          isDark ? "border-slate-800" : "border-slate-100"
        }`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Live Consultation</p>
            <h2 className={`mt-1 text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>{counterpartName}</h2>
            <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{formatDateTime(appointmentTime)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
            status === "connected"
              ? isDark ? "bg-emerald-500/15 text-emerald-300" : "border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold"
              : isDark ? "bg-amber-500/15 text-amber-300" : "border border-amber-300 bg-amber-50 text-amber-800 font-bold"
          }`}>
            {statusLabel}
          </span>
        </header>
        <div className={`flex flex-wrap items-center gap-2 border-b px-4 py-3 ${
          isDark ? "border-slate-800" : "border-slate-100"
        }`}>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
            connectionState === "failed"
              ? "bg-red-500/15 text-red-400"
              : isDark ? "bg-white/10 text-slate-200" : "border border-slate-200 bg-slate-100 text-slate-700 font-semibold"
          }`}>
            {connectionLabel}
          </span>
          {status === "connected" && (
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
              isDark ? "border-white/10 bg-white/5 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"
            }`}>
              {callDuration}
            </span>
          )}
          {isScreenSharing && (
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-200">
              Presenting
            </span>
          )}
          {mediaError && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-500">
              {mediaError}
            </span>
          )}
        </div>
        <div className={`border-b px-4 py-3 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
          <MediaDeviceControls
            devices={devices}
            cameraDeviceId={cameraDeviceId}
            microphoneDeviceId={microphoneDeviceId}
            deviceStatus={deviceStatus}
            onCameraDeviceChange={onCameraDeviceChange}
            onMicrophoneDeviceChange={onMicrophoneDeviceChange}
            onRefreshDevices={onRefreshDevices}
          />
        </div>
        {isScreenSharing && screenShareStream ? (
          <div className="flex flex-col gap-4 p-4 pb-28 min-h-[480px]">
            {/* Minimized Camera Previews */}
            <div className="grid grid-cols-2 gap-3">
              {/* Minimized Local Camera */}
              <div className="relative h-[160px] sm:h-[180px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-md">
                <ConsultationVideoTile
                  stream={localStream}
                  label="You (Camera)"
                  detail={isCameraOn ? "Camera on" : "Camera off"}
                  active={isCameraOn}
                  cameraOn={isCameraOn}
                  micOn={isMicOn}
                  muted={true}
                  className="h-full"
                  tone="slate"
                />
              </div>

              {/* Minimized Counterpart Camera */}
              <div className="relative h-[160px] sm:h-[180px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-md">
                <ConsultationVideoTile
                  stream={remoteStream}
                  label={counterpartName}
                  detail={
                    counterpartCameraOn
                      ? role === "doctor"
                        ? "Patient stream"
                        : "Doctor stream"
                      : "Camera disabled"
                  }
                  active={Boolean(counterpartCameraOn)}
                  cameraOn={counterpartCameraOn}
                  micOn={counterpartMicOn}
                  muted={false}
                  className="h-full"
                  tone="teal"
                />
              </div>
            </div>

            {/* Dedicated Screen Share Presentation Preview */}
            <div className="relative min-h-[380px] md:min-h-[460px] overflow-hidden rounded-xl border-2 border-cyan-500/40 bg-slate-950 shadow-2xl">
              <ConsultationVideoTile
                stream={screenShareStream}
                label="Your Screen Presentation"
                detail="Presenting screen in real time"
                active={true}
                cameraOn={true}
                micOn={isMicOn}
                muted={true}
                className="h-full min-h-[380px] md:min-h-[460px]"
                tone="teal"
              />
            </div>
          </div>
        ) : (
          <div className="grid min-h-[480px] gap-4 p-4 pb-28 md:grid-cols-2">
            {/* Left: Your local camera preview */}
            <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <ConsultationVideoTile
                stream={localStream}
                label="Your stream"
                detail={isCameraOn ? "Camera active" : "Camera disabled"}
                active={isCameraOn}
                cameraOn={isCameraOn}
                micOn={isMicOn}
                muted={true}
                className="h-full min-h-[420px]"
                tone="slate"
              />
            </div>

            {/* Right: Counterpart remote feed */}
            <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <ConsultationVideoTile
                stream={remoteStream}
                label={counterpartName}
                detail={
                  counterpartScreenSharing
                    ? "Screen sharing"
                    : counterpartCameraOn
                      ? role === "doctor"
                        ? "Patient stream"
                        : "Doctor stream"
                      : "Camera disabled"
                }
                active={Boolean(counterpartCameraOn)}
                cameraOn={counterpartCameraOn}
                micOn={counterpartMicOn}
                muted={false}
                className="h-full min-h-[420px]"
                tone="teal"
              />
            </div>
          </div>
        )}
        <footer className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-4 rounded-full border border-white/10 bg-[rgba(24,24,27,0.7)] px-5 py-3 shadow-2xl shadow-black/30 backdrop-blur-[12px]">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleCamera}
              aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
              title={isCameraOn ? "Turn camera off" : "Turn camera on"}
              className={`grid h-12 w-12 place-items-center rounded-full border transition focus:outline-none focus:ring-4 ${
                isCameraOn
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/15 focus:ring-white/20"
                  : "border-red-300/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 focus:ring-red-300/30"
              }`}
            >
              <VideoControlIcon off={!isCameraOn} />
            </button>
            <button
              type="button"
              onClick={onToggleMic}
              aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
              title={isMicOn ? "Mute microphone" : "Unmute microphone"}
              className={`grid h-12 w-12 place-items-center rounded-full border transition focus:outline-none focus:ring-4 ${
                isMicOn
                  ? "border-white/15 bg-white/10 text-white hover:bg-white/15 focus:ring-white/20"
                  : "border-red-300/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 focus:ring-red-300/30"
              }`}
            >
              <MicControlIcon off={!isMicOn} />
            </button>
            <button
              type="button"
              onClick={onToggleScreenShare}
              disabled={!screenShareSupported}
              aria-label={isScreenSharing ? "Stop screen share" : "Start screen share"}
              title={screenShareSupported ? (isScreenSharing ? "Stop screen share" : "Start screen share") : "Screen sharing not supported"}
              className={`grid h-12 w-12 place-items-center rounded-full border transition focus:outline-none focus:ring-4 ${
                isScreenSharing
                  ? "border-cyan-300/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20 focus:ring-cyan-300/20"
                  : "border-white/15 bg-white/10 text-white hover:bg-white/15 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              }`}
            >
              <ScreenShareIcon off={!isScreenSharing} />
            </button>
          </div>
          <button
            type="button"
            onClick={onEnd}
            aria-label="End consultation"
            title="End consultation"
            className="grid h-14 w-14 place-items-center rounded-full bg-brand-red text-white shadow-lg shadow-red-950/40 transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300"
          >
            <PhoneDownIcon />
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
export function FloatingConsultationCall({
  role,
  counterpartName,
  status,
  isCameraOn,
  isMicOn,
  isScreenSharing = false,
  counterpartCameraOn = true,
  counterpartMicOn = true,
  counterpartScreenSharing = false,
  connectedAt = null,
  localStream = null,
  screenShareStream = null,
  remoteStream = null,
  connectionState = "new",
  mediaError = null,
  screenShareSupported = true,
  onOpen,
  onToggleCamera,
  onToggleMic,
  onToggleScreenShare,
  onEnd,
}: {
  role: DashboardRole;
  counterpartName: string;
  status: "waiting" | "connected";
  isCameraOn: boolean;
  isMicOn: boolean;
  isScreenSharing?: boolean;
  counterpartCameraOn?: boolean;
  counterpartMicOn?: boolean;
  counterpartScreenSharing?: boolean;
  connectedAt?: number | null;
  localStream?: MediaStream | null;
  screenShareStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  connectionState?: RTCPeerConnectionState;
  mediaError?: string | null;
  screenShareSupported?: boolean;
  onOpen: () => void;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleScreenShare?: () => void;
  onEnd: () => void;
}) {
  const remoteVideoActive = Boolean(remoteStream?.getVideoTracks().length && counterpartCameraOn);
  const localPreviewStream = isScreenSharing && screenShareStream ? screenShareStream : localStream;
  const localVideoActive = Boolean(localPreviewStream?.getVideoTracks().length && (isScreenSharing || isCameraOn));
  const stateText = connectionState === "connected" ? "Connected" : status === "waiting" ? "Waiting" : "Reconnecting";
  const callDuration = useCallDuration(connectedAt);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    originX: 16,
    originY: 16,
  });

  const clampPosition = useCallback((nextX: number, nextY: number) => {
    if (typeof window === "undefined") {
      return { x: nextX, y: nextY };
    }

    const width = Math.min(352, window.innerWidth - 32);
    const height = 360;

    return {
      x: Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(8, nextY), Math.max(8, window.innerHeight - height - 8)),
    };
  }, []);

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button")) {
      return;
    }

    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current.active) {
      return;
    }

    const nextX = dragRef.current.originX + event.clientX - dragRef.current.startX;
    const nextY = dragRef.current.originY + event.clientY - dragRef.current.startY;
    setPosition(clampPosition(nextX, nextY));
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside
      className="fixed z-[90] w-[min(22rem,calc(100vw-2rem))] touch-none overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-white shadow-2xl shadow-black/40"
      style={{ left: position.x, top: position.y }}
      onPointerDown={handleDragStart}
      onPointerMove={handleDragMove}
      onPointerUp={handleDragEnd}
      onPointerCancel={handleDragEnd}
    >
      <div className="relative h-44 bg-slate-900">
        <div className="absolute left-3 top-3 z-10 rounded-full border border-white/10 bg-slate-950/70 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300 backdrop-blur">
          Drag
        </div>
        <div className="absolute right-3 top-3 z-10 flex gap-1">
          {counterpartScreenSharing && (
            <span className="rounded-full bg-cyan-500/80 p-1 text-white backdrop-blur" title="Screen sharing">
              <ScreenShareIcon />
            </span>
          )}
          {!counterpartCameraOn && (
            <span className="rounded-full bg-rose-500/80 p-1 text-white backdrop-blur" title="Camera off">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 13 5 3V8l-5 3" />
                <rect width="14" height="10" x="2" y="7" rx="2" />
                <path d="M3 3l18 18" />
              </svg>
            </span>
          )}
          {!counterpartMicOn && (
            <span className="rounded-full bg-rose-500/80 p-1 text-white backdrop-blur" title="Muted">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <path d="M12 19v3" />
                <path d="M3 3l18 18" />
              </svg>
            </span>
          )}
        </div>
        <VideoStream stream={remoteStream} active={counterpartCameraOn || counterpartScreenSharing} />
        {!remoteVideoActive && (
          <div className="absolute inset-0 grid place-items-center bg-slate-900 p-4 text-center">
            <div>
              <p className="text-sm font-black">{counterpartName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{role === "doctor" ? "Patient" : "Doctor"} video unavailable</p>
            </div>
          </div>
        )}
        <div className="absolute bottom-3 right-3 h-20 w-28 overflow-hidden rounded-lg border border-white/15 bg-slate-800 shadow-xl">
          <VideoStream stream={localPreviewStream} muted active={isScreenSharing || isCameraOn} />
          {!localVideoActive && <div className="grid h-full place-items-center text-[10px] font-black uppercase text-slate-300">You</div>}
        </div>
      </div>
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{counterpartName}</p>
            <p className={`text-[11px] font-bold ${mediaError ? "text-amber-200" : "text-emerald-200"}`}>
              {mediaError || stateText}
            </p>
            {status === "connected" && <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{callDuration}</p>}
          </div>
          <button type="button" onClick={onOpen} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white" aria-label="Open consultation">
            <MaximizeIcon />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onToggleCamera} className={`grid h-10 w-10 place-items-center rounded-full ${isCameraOn ? "bg-white/10" : "bg-red-500/20 text-red-100"}`} aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}>
            <VideoControlIcon off={!isCameraOn} />
          </button>
          <button type="button" onClick={onToggleMic} className={`grid h-10 w-10 place-items-center rounded-full ${isMicOn ? "bg-white/10" : "bg-red-500/20 text-red-100"}`} aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}>
            <MicControlIcon off={!isMicOn} />
          </button>
          <button
            type="button"
            onClick={onToggleScreenShare}
            disabled={!screenShareSupported}
            className={`grid h-10 w-10 place-items-center rounded-full ${
              isScreenSharing ? "bg-cyan-500/20 text-cyan-100" : "bg-white/10"
            } disabled:cursor-not-allowed disabled:opacity-50`}
            aria-label={isScreenSharing ? "Stop screen share" : "Start screen share"}
            title={screenShareSupported ? (isScreenSharing ? "Stop screen share" : "Start screen share") : "Screen sharing not supported"}
          >
            <ScreenShareIcon off={!isScreenSharing} />
          </button>
          <button type="button" onClick={onEnd} className="grid h-11 w-11 place-items-center rounded-full bg-brand-red text-white" aria-label="End consultation">
            <PhoneDownIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}

export type PrescriptionListItem = {
  id: string;
  prescription: string | null;
  reason?: string | null;
  scheduledAt: Date | string;
  owner: string;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorLicense?: string | null;
  doctorNpi?: string | null;
  clinicName?: string;
  patientName?: string;
  patientAge?: string | number;
  patientGender?: string | null;
  patientAddress?: string | null;
};

export function PrescriptionList({
  items,
  role,
  tone = "light",
  onDownloadPdf,
}: {
  items: PrescriptionListItem[];
  role: DashboardRole;
  tone?: "light" | "dark";
  onDownloadPdf?: (item: PrescriptionListItem) => void;
}) {
  const active = items.filter((item) => item.prescription);

  const handleDownload = (item: PrescriptionListItem) => {
    if (onDownloadPdf) {
      onDownloadPdf(item);
      return;
    }
    const docName = item.doctorName || (role === "patient" ? item.owner : "Medical Doctor");
    const patName = item.patientName || (role === "doctor" ? item.owner : "Patient");

    downloadPrescriptionPdf({
      appointmentId: item.id,
      doctorName: docName,
      doctorSpecialty: item.doctorSpecialty || "General & Specialty Practice",
      doctorLicense: item.doctorLicense,
      doctorNpi: item.doctorNpi,
      clinicName: item.clinicName,
      patientName: patName,
      patientAge: item.patientAge,
      patientGender: item.patientGender,
      patientAddress: item.patientAddress,
      date: item.scheduledAt,
      diagnosis: item.reason,
      prescription: item.prescription || "No prescription recorded.",
    });
  };

  return active.length ? (
    <div className="grid gap-4 md:grid-cols-2">
      {active.map((item) => (
        <article
          key={item.id}
          className={`rounded-xl border p-5 transition-colors ${
            tone === "dark"
              ? "border-teal-500/30 bg-slate-900 text-white shadow-xs"
              : "border-teal-600/20 bg-white text-slate-950 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">
              Official Rx
            </span>
            <span className={`text-[11px] font-semibold ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              {formatDate(item.scheduledAt)}
            </span>
          </div>

          <p className={`mt-3 text-xs font-semibold ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>
            {role === "doctor" ? "Patient" : "Physician"}: <span className="font-bold text-slate-900 dark:text-white">{item.owner}</span>
          </p>
          {item.reason && (
            <p className={`mt-1 text-xs ${tone === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              Diagnosis / Reason: <span className="font-semibold">{item.reason}</span>
            </p>
          )}

          <div className={`mt-3 max-h-40 overflow-y-auto rounded-lg p-3 text-xs leading-relaxed whitespace-pre-line ${
            tone === "dark" ? "bg-slate-800/80 text-slate-200 border border-slate-700" : "bg-slate-50 text-slate-800 border border-slate-200"
          }`}>
            {item.prescription}
          </div>

          <button
            type="button"
            onClick={() => handleDownload(item)}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-black transition-colors ${
              tone === "dark"
                ? "border-teal-500/40 bg-teal-500/20 text-teal-200 hover:bg-teal-500/30"
                : "border-teal-600/30 bg-teal-50 text-teal-800 hover:bg-teal-100"
            }`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Download Rx PDF
          </button>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState tone={tone} title="No active prescriptions" body="Prescriptions issued during completed visits appear here." />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WaitingLobby — shown on doctor side while waiting for patient to connect
// ─────────────────────────────────────────────────────────────────────────────

const WAIT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WAIT_WARNING_MS = 2 * 60 * 1000;  // warn when 2 minutes remain

function useWaitingTimer(startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (!startedAt) {
    return { elapsed: 0, remaining: WAIT_TIMEOUT_MS, isExpired: false, isWarning: false, elapsedLabel: "0:00", remainingLabel: "10:00", progressPct: 100 };
  }

  const elapsed = now - startedAt;
  const remaining = Math.max(0, WAIT_TIMEOUT_MS - elapsed);
  const isExpired = remaining === 0;
  const isWarning = remaining <= WAIT_WARNING_MS && !isExpired;

  const fmt = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return {
    elapsed,
    remaining,
    isExpired,
    isWarning,
    elapsedLabel: fmt(elapsed),
    remainingLabel: fmt(remaining),
    progressPct: Math.max(0, (remaining / WAIT_TIMEOUT_MS) * 100),
  };
}

export function WaitingLobby({
  patientName,
  waitingStartedAt,
  onEndSession,
  onMarkNoShow,
  tone = "light",
}: {
  patientName: string;
  waitingStartedAt: number | null;
  onEndSession: () => void;
  onMarkNoShow: () => void;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  const timer = useWaitingTimer(waitingStartedAt);

  const progressColor = timer.isExpired
    ? "bg-red-500"
    : timer.isWarning
      ? "bg-amber-500"
      : "bg-brand-teal";

  const initials = patientName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={`flex min-h-[calc(100vh-9rem)] flex-col items-center justify-center gap-8 rounded-xl border p-8 text-center transition-colors ${
        isDark ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"
      }`}
    >
      {/* Pulsing avatar ring */}
      <div className="relative flex items-center justify-center">
        {!timer.isExpired && (
          <>
            <span
              className="absolute h-40 w-40 animate-ping rounded-full bg-brand-teal/10"
              style={{ animationDuration: "2.4s" }}
            />
            <span
              className="absolute h-32 w-32 animate-ping rounded-full bg-brand-teal/15"
              style={{ animationDuration: "2.4s", animationDelay: "0.6s" }}
            />
          </>
        )}
        <div
          className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full text-3xl font-black shadow-xl ring-4 ${
            timer.isExpired
              ? isDark
                ? "bg-red-500/20 text-red-300 ring-red-500/30"
                : "bg-red-100 text-red-700 ring-red-200"
              : timer.isWarning
                ? isDark
                  ? "bg-amber-500/20 text-amber-200 ring-amber-500/30"
                  : "bg-amber-100 text-amber-800 ring-amber-200"
                : isDark
                  ? "bg-brand-teal/15 text-brand-teal ring-brand-teal/20"
                  : "bg-teal-50 text-brand-teal ring-teal-100"
          }`}
        >
          {initials}
        </div>
      </div>

      {/* Status header */}
      <div className="space-y-1.5">
        {timer.isExpired ? (
          <>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-500">Connection Timeout</p>
            <h2 className={`font-display text-2xl font-black ${isDark ? "text-white" : "text-slate-950"}`}>
              Patient did not connect
            </h2>
            <p className={`text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <span className={`font-black ${isDark ? "text-white" : "text-slate-800"}`}>{patientName}</span> did not
              join within the 10-minute window.
            </p>
          </>
        ) : (
          <>
            <p
              className={`text-[10px] font-black uppercase tracking-[0.28em] ${
                timer.isWarning ? "text-amber-500" : "text-brand-teal"
              }`}
            >
              {timer.isWarning ? "Waiting — Time Running Out" : "Waiting for Patient"}
            </p>
            <h2 className={`font-display text-2xl font-black ${isDark ? "text-white" : "text-slate-950"}`}>
              {patientName}
            </h2>
            <p className={`text-sm font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {timer.isWarning
                ? "Patient has not joined yet. The session will auto-expire soon."
                : "The secure room is open. Waiting for the patient to join."}
            </p>
          </>
        )}
      </div>

      {/* Timer + Progress bar */}
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-between text-xs font-black">
          <span className={isDark ? "text-slate-400" : "text-slate-500"}>
            Elapsed:{" "}
            <span className={isDark ? "text-white" : "text-slate-900"}>{timer.elapsedLabel}</span>
          </span>
          <span
            className={
              timer.isExpired
                ? "text-red-500"
                : timer.isWarning
                  ? "text-amber-500"
                  : isDark
                    ? "text-slate-400"
                    : "text-slate-500"
            }
          >
            {timer.isExpired ? "Timed out" : `Remaining: ${timer.remainingLabel}`}
          </span>
        </div>

        <div className={`h-2 w-full overflow-hidden rounded-full ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
          <div
            className={`h-full rounded-full transition-all duration-1000 ${progressColor}`}
            style={{ width: `${timer.isExpired ? 100 : timer.progressPct}%` }}
          />
        </div>

        {timer.isWarning && !timer.isExpired && (
          <p
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              isDark
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            ⚠️ Less than {timer.remainingLabel} remaining. Consider marking this patient as No Show if they
            don&apos;t connect soon.
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {timer.isExpired ? (
          <>
            <button
              type="button"
              onClick={onMarkNoShow}
              className="rounded-xl bg-amber-600 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:bg-amber-700"
            >
              Mark as No Show
            </button>
            <button
              type="button"
              onClick={onEndSession}
              className={`rounded-xl border px-6 py-3 text-sm font-black transition ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              End Session
            </button>
          </>
        ) : (
          <>
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-300"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-teal" />
              Secure room open
            </div>
            <button
              type="button"
              onClick={onEndSession}
              className={`rounded-xl border px-5 py-2.5 text-xs font-black transition ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              Cancel &amp; End Session
            </button>
          </>
        )}
      </div>

      {!timer.isExpired && (
        <p className={`text-[11px] leading-relaxed ${isDark ? "text-slate-600" : "text-slate-400"}`}>
          The patient was notified and has up to <strong>10 minutes</strong> to join.
          <br />
          Session will auto-expire when the countdown reaches 0:00.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DateRangePicker — calendar popover that lets the user pick a date range
// with a configurable max-day cap.
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function parseLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DateRangePicker({
  from,
  to,
  onChange,
  maxDays = 26,
  tone = "light",
}: {
  from: string;   // "YYYY-MM-DD" or ""
  to: string;     // "YYYY-MM-DD" or ""
  onChange: (from: string, to: string) => void;
  maxDays?: number;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  const [isOpen, setIsOpen] = useState(false);
  const [picking, setPicking] = useState<"from" | "to">("from");
  const [hover, setHover] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const seed = from ? parseLocal(from) : new Date();
  const [viewYear, setViewYear] = useState(seed.getFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getMonth());

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [isOpen]);

  const todayStr = isoDate(new Date());

  function handleDayClick(dayStr: string) {
    if (picking === "from") {
      onChange(dayStr, "");
      setPicking("to");
    } else {
      if (!from) { onChange(dayStr, ""); setPicking("to"); return; }
      const fromD = parseLocal(from);
      const clickD = parseLocal(dayStr);
      if (clickD < fromD) {
        // Clicked before start — restart from here
        onChange(dayStr, "");
        setPicking("to");
        return;
      }
      const diff = Math.round((clickD.getTime() - fromD.getTime()) / 86_400_000);
      const finalTo = diff > maxDays ? isoDate(addDays(fromD, maxDays)) : dayStr;
      onChange(from, finalTo);
      setPicking("from");
      setIsOpen(false);
    }
  }

  function effectiveTo() {
    if (picking === "to" && hover) return hover;
    return to;
  }

  function isStart(d: string) { return d === from; }
  function isEnd(d: string) { return d === effectiveTo(); }
  function inRange(d: string) {
    const eff = effectiveTo();
    if (!from || !eff) return false;
    return d > from && d < eff;
  }
  function isDisabled(d: string) {
    if (picking === "to" && from && d < from) return true;
    return false;
  }

  function getCalDays(): string[] {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startDow = firstOfMonth.getDay(); // 0=Sun ... 6=Sat
    // First cell is startDow days before the 1st
    const startDate = new Date(viewYear, viewMonth, 1 - startDow);
    const days: string[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(isoDate(addDays(startDate, i)));
    }
    return days;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const calDays = getCalDays();
  const hasRange = from && to;

  const triggerLabel = hasRange
    ? `${parseLocal(from).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${parseLocal(to).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : from
      ? `From ${parseLocal(from).toLocaleDateString("en-US", { month: "short", day: "numeric" })}…`
      : "Filter by date range";

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(o => !o);
          setPicking(from && !to ? "to" : "from");
        }}
        className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
          isDark
            ? `bg-slate-800 ${hasRange || from ? "border-brand-teal/50" : "border-slate-700"} hover:border-brand-teal`
            : `bg-slate-50 ${hasRange || from ? "border-brand-teal/40" : "border-slate-200"} hover:border-brand-teal`
        }`}
      >
        <svg className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-slate-400" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className={`flex-1 truncate text-xs font-semibold ${
          hasRange || from
            ? isDark ? "text-white" : "text-slate-900"
            : isDark ? "text-slate-400" : "text-slate-400"
        }`}>
          {triggerLabel}
        </span>
        {(from || to) && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange("", ""); setPicking("from"); }}
            onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onChange("", ""), setPicking("from"))}
            className={`cursor-pointer text-xs font-black transition ${isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}
          >✕</span>
        )}
      </button>

      {/* Calendar popover */}
      {isOpen && (
        <div className={`absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border p-4 shadow-2xl ${
          isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
        }`}>
          {/* Picking hint */}
          <p className={`mb-3 text-center text-[9px] font-black uppercase tracking-[0.25em] ${
            picking === "from" ? "text-brand-teal" : "text-sky-500"
          }`}>
            {picking === "from" ? "Click to set start date" : `Click to set end date · max ${maxDays} days`}
          </p>

          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={prevMonth} className={`rounded-lg p-1.5 transition ${isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <p className={`text-xs font-black ${isDark ? "text-white" : "text-slate-900"}`}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </p>
            <button type="button" onClick={nextMonth} className={`rounded-lg p-1.5 transition ${isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="mb-1 grid grid-cols-7">
            {DAY_NAMES.map((d) => (
              <div key={d} className={`text-center text-[9px] font-black uppercase ${isDark ? "text-slate-600" : "text-slate-400"}`}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {calDays.map((dayStr, idx) => {
              const isThisMonth = parseLocal(dayStr).getMonth() === viewMonth;
              const start = isStart(dayStr);
              const end = isEnd(dayStr);
              const ranged = inRange(dayStr);
              const disabled = isDisabled(dayStr);
              const today = dayStr === todayStr;

              return (
                <button
                  key={`${dayStr}-${idx}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDayClick(dayStr)}
                  onMouseEnter={() => picking === "to" && setHover(dayStr)}
                  onMouseLeave={() => setHover(null)}
                  className={[
                    "h-8 w-full rounded-md text-[11px] transition-all",
                    !isThisMonth && "opacity-25",
                    disabled && "cursor-not-allowed opacity-20",
                    start || end
                      ? "bg-brand-teal font-black text-white shadow-sm"
                      : ranged
                        ? isDark ? "bg-brand-teal/20 font-semibold text-brand-teal" : "bg-teal-50 font-semibold text-teal-700"
                        : today
                          ? isDark ? "font-black text-brand-teal ring-1 ring-brand-teal/40" : "font-black text-brand-teal ring-1 ring-brand-teal/30"
                          : isDark ? "font-medium text-slate-300 hover:bg-slate-800" : "font-medium text-slate-700 hover:bg-slate-100",
                  ].filter(Boolean).join(" ")}
                >
                  {parseLocal(dayStr).getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <p className={`mt-3 text-center text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            Maximum range: <strong className={isDark ? "text-slate-400" : "text-slate-600"}>{maxDays} days</strong>
          </p>
        </div>
      )}
    </div>
  );
}
