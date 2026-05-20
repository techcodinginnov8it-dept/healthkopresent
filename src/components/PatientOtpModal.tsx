"use client";

type PatientOtpModalProps = {
  open: boolean;
  title: string;
  description: string;
  email: string;
  otpDigits: string[];
  otpError: string;
  loading: boolean;
  actionLabel: string;
  onOtpChange: (value: string, idx: number) => void;
  onOtpKeyDown: (event: React.KeyboardEvent<HTMLInputElement>, idx: number) => void;
  onSubmit: () => void;
  onClose: () => void;
  onClear: () => void;
};

export default function PatientOtpModal({
  open,
  title,
  description,
  email,
  otpDigits,
  otpError,
  loading,
  actionLabel,
  onOtpChange,
  onOtpKeyDown,
  onSubmit,
  onClose,
  onClear,
}: PatientOtpModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-2xl sm:p-8">
        <div className="space-y-6">
          <div className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-brand-teal/20 bg-brand-teal/10 text-brand-teal">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="font-display text-xl font-black tracking-tight">{title}</h3>
              <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-400">
                {description}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-teal">
                {email}
              </p>
            </div>
          </div>

          {otpError && (
            <div className="rounded-xl border border-brand-red/15 bg-brand-red/10 p-3 text-center text-xs font-bold text-brand-red">
              {otpError}
            </div>
          )}

          <div className="flex justify-center gap-2 py-2 sm:gap-3">
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                id={`patient-otp-input-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(event) => onOtpChange(event.target.value, idx)}
                onKeyDown={(event) => onOtpKeyDown(event, idx)}
                className="h-12 w-10 rounded-xl border border-slate-800 bg-slate-950 text-center text-lg font-bold text-brand-teal outline-none transition-all focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 sm:h-14 sm:w-12"
                placeholder="-"
              />
            ))}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-brand-teal py-3.5 text-sm font-bold text-white shadow-md shadow-brand-teal/15 transition-all hover:bg-brand-teal-hover disabled:bg-slate-800 disabled:shadow-none"
            >
              {loading ? "Verifying Code..." : actionLabel}
            </button>

            <div className="flex items-center justify-between px-1 text-xs font-semibold">
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 transition-colors hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onClear}
                className="text-brand-teal hover:underline"
              >
                Clear digits
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
