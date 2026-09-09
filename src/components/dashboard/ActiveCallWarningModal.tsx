"use client";

import React from "react";

interface ActiveCallWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEndCall?: () => void;
}

export function ActiveCallWarningModal({
  isOpen,
  onClose,
  onEndCall,
}: ActiveCallWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-call-warning-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-neutral-900/95 border border-rose-500/40 p-6 shadow-2xl shadow-rose-500/10 text-white backdrop-blur-xl">
        {/* Pulsing Icon */}
        <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto mb-5 shadow-inner">
          <svg className="w-7 h-7 animate-bounce text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
          </span>
        </div>

        {/* Title */}
        <h2
          id="active-call-warning-title"
          className="text-xl font-bold text-center tracking-tight text-white mb-2"
        >
          Active Consultation In Progress
        </h2>

        {/* Explanation */}
        <p className="text-sm text-neutral-300 text-center leading-relaxed mb-6">
          You are currently in an active medical call. Navigating back or exiting will interrupt the consultation. Please conclude your session using the <span className="text-rose-400 font-semibold">End Call</span> button before leaving.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-medium text-sm text-center shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
            Stay in Consultation
          </button>

          {onEndCall && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEndCall();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-medium text-sm transition-all border border-rose-500/60 flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                <line x1="22" x2="2" y1="2" y2="22" />
              </svg>
              End Call and Leave
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
