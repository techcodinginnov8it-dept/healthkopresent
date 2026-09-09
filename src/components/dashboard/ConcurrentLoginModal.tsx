"use client";

import React from "react";

interface ConcurrentLoginModalProps {
  isOpen: boolean;
  role: "doctor" | "patient";
  newDevice?: string;
  loginTime?: string;
  onLogout: () => void;
}

export function ConcurrentLoginModal({
  isOpen,
  role,
  newDevice,
  loginTime,
  onLogout,
}: ConcurrentLoginModalProps) {
  if (!isOpen) return null;

  const formattedTime = loginTime
    ? new Date(loginTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Just now";

  const loginUrl = role === "doctor" ? "/doctor/signin" : "/signin";

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="concurrent-login-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-neutral-900/95 border border-amber-500/30 p-6 shadow-2xl shadow-amber-500/10 text-white backdrop-blur-xl">
        {/* Header Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto mb-5 shadow-inner">
          <svg className="w-7 h-7 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="concurrent-login-title"
          className="text-xl font-bold text-center tracking-tight text-white mb-2"
        >
          Account Active on Another Device
        </h2>

        {/* Description */}
        <p className="text-sm text-neutral-300 text-center leading-relaxed mb-5">
          Your HealthKo account was just accessed from a new device or browser. To protect your medical privacy and HIPAA security, only one active session is permitted at a time.
        </p>

        {/* Device Information Card */}
        <div className="rounded-xl bg-neutral-950/70 border border-neutral-800 p-4 mb-6 space-y-2.5 text-xs text-neutral-300">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-neutral-400">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="12" x="3" y="4" rx="2" ry="2" />
                <line x1="2" y1="20" x2="22" y2="20" />
              </svg>
              Active Device:
            </span>
            <span className="font-semibold text-neutral-100">{newDevice || "Unknown Browser / Device"}</span>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-800/80 pt-2">
            <span className="flex items-center gap-1.5 text-neutral-400">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Login Time:
            </span>
            <span className="font-semibold text-neutral-200">{formattedTime}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <a
            href={loginUrl}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium text-sm text-center shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Log In on This Device
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white font-medium text-sm transition-all border border-neutral-700/60 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
