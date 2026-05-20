"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyResetOtp, applyNewPassword } from "../actions/password-reset";

function ResetPasswordFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // OTP modal state
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Reset token is missing from the link. Please request a new link.");
    }
  }, [token]);

  const handleOpenOtpModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Invalid reset token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setShowOtpModal(true);
  };

  useEffect(() => {
    if (showOtpModal) {
      // Auto focus first OTP input when modal opens
      setTimeout(() => {
        document.getElementById("otp-input-0")?.focus();
      }, 100);
    }
  }, [showOtpModal]);

  const handleOtpChange = (val: string, index: number) => {
    const clean = val.replace(/[^0-9]/g, "");
    if (!clean) return;

    const nextDigits = [...otpDigits];
    nextDigits[index] = clean[0];
    setOtpDigits(nextDigits);

    // Auto focus next input
    if (index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      const nextDigits = [...otpDigits];
      if (nextDigits[index]) {
        nextDigits[index] = "";
        setOtpDigits(nextDigits);
      } else if (index > 0) {
        nextDigits[index - 1] = "";
        setOtpDigits(nextDigits);
        const prevInput = document.getElementById(`otp-input-${index - 1}`);
        prevInput?.focus();
      }
    }
  };

  const handleVerifyAndReset = async () => {
    const fullOtp = otpDigits.join("");
    if (fullOtp.length !== 6) {
      setOtpError("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    setOtpError("");

    try {
      // 1. Verify OTP first
      const verifyRes = await verifyResetOtp({ token, otp: fullOtp });
      if (!verifyRes.success) {
        setLoading(false);
        setOtpError(verifyRes.error || "Incorrect verification code.");
        return;
      }

      // 2. Apply new password
      const applyRes = await applyNewPassword({
        token,
        otp: fullOtp,
        newPassword: password,
      });

      setLoading(false);
      if (applyRes.success) {
        setSuccess(true);
        setShowOtpModal(false);
      } else {
        setOtpError(applyRes.error || "Failed to update password.");
      }
    } catch (err: any) {
      setLoading(false);
      setOtpError("A connection error occurred. Please try again.");
    }
  };

  return (
    <div className="max-w-md w-full">
      {!success ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-7 relative">
          {/* Icon */}
          <div className="h-14 w-14 rounded-full bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center text-brand-teal mx-auto">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          {/* Title */}
          <div className="text-center space-y-1.5">
            <h1 className="font-display text-2xl font-black text-white tracking-tight">Create New Password</h1>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              Choose a strong password to secure your HealthKo patient or physician dashboard.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-brand-red/10 border border-brand-red/15 text-brand-red font-bold text-xs rounded-xl text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleOpenOtpModal} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={!token}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                Confirm New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={!token}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all disabled:opacity-50"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!token}
              className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md shadow-brand-teal/15 disabled:bg-slate-800 disabled:shadow-none flex items-center justify-center space-x-2"
            >
              <span>Verify passcode & Reset</span>
            </button>
          </form>
        </div>
      ) : (
        /* Success screen */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-fade-in">
          <div className="h-16 w-16 rounded-full bg-brand-teal/10 border-2 border-brand-teal/30 flex items-center justify-center text-brand-teal mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl font-black text-white tracking-tight font-sans">Password Updated</h2>
            <p className="text-slate-450 text-sm font-semibold max-w-xs mx-auto leading-relaxed">
              Your security credentials have been securely updated. You can now access your console.
            </p>
          </div>

          <div className="pt-4 grid grid-cols-2 gap-3">
            <Link
              href="/signin"
              className="py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center"
            >
              Patient Login
            </Link>
            <Link
              href="/doctor/signin"
              className="py-3 bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-brand-teal/15 flex items-center justify-center"
            >
              Physician Login
            </Link>
          </div>
        </div>
      )}

      {/* ── OTP Verification Modal ── */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md transition-all duration-300">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4 shadow-2xl space-y-6 transform scale-100 transition-all duration-300 animate-fade-in">
            
            {/* Modal Header */}
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center text-brand-teal mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="font-display font-black text-xl tracking-tight text-white font-sans">Verification OTP</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Please enter the 6-digit security code sent to your email to verify password reset ownership.
              </p>
            </div>

            {/* Error Alert in Modal */}
            {otpError && (
              <div className="p-3 bg-brand-red/10 border border-brand-red/15 text-brand-red font-bold text-xs rounded-xl text-center">
                {otpError}
              </div>
            )}

            {/* 6 Digit Inputs Grid */}
            <div className="flex justify-center gap-2 sm:gap-3 py-2">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-input-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(e.target.value, idx)}
                  onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg font-bold bg-slate-950 border border-slate-800 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 rounded-xl focus:outline-none transition-all text-brand-teal"
                  placeholder="-"
                />
              ))}
            </div>

            {/* Modal Actions */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleVerifyAndReset}
                disabled={loading}
                className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md shadow-brand-teal/15 disabled:bg-slate-800 disabled:shadow-none flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying & Resetting...</span>
                  </>
                ) : (
                  <span>Confirm Password Update</span>
                )}
              </button>

              <div className="flex justify-between items-center text-xs font-semibold px-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpModal(false);
                    setOtpError("");
                  }}
                  className="text-slate-450 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpDigits(["", "", "", "", "", ""]);
                    setOtpError("");
                    document.getElementById("otp-input-0")?.focus();
                  }}
                  className="text-brand-teal hover:underline"
                >
                  Clear digits
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-teal/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-10">
        <Link href="/" className="flex items-center space-x-1 select-none">
          <span className="font-display text-2xl tracking-tight">
            <span className="text-brand-red font-black">H</span>
            <span className="text-white font-extrabold">ealth</span>
            <span className="text-brand-teal font-black">K</span>
            <span className="text-white font-extrabold">o</span>
          </span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <Suspense fallback={
          <div className="text-center text-slate-400 font-bold text-sm">
            Initializing secure recovery tunnel...
          </div>
        }>
          <ResetPasswordFormContent />
        </Suspense>
      </main>

      <footer className="border-t border-slate-900 py-5 px-6 text-center text-[10px] text-slate-600 font-bold uppercase tracking-wider relative z-10">
        © {new Date().getFullYear()} HealthKo Technologies, Inc. • HIPAA Secure Credential Reset
      </footer>
    </div>
  );
}
