"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "../actions/password-reset";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"patient" | "doctor">("patient");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your registered email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await requestPasswordReset({ email, userType });
      setLoading(false);
      if (res.success) {
        setSent(true);
      } else {
        setError(res.error || "Failed to send the reset link. Please try again.");
      }
    } catch (err: any) {
      setLoading(false);
      setError("A connection error occurred. Please check your network and try again.");
    }
  };

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
        <div className="flex items-center space-x-4 text-xs font-bold">
          <Link href="/signin" className="text-slate-400 hover:text-slate-100 transition-colors">Patient Sign In</Link>
          <Link href="/doctor/signin" className="text-slate-400 hover:text-slate-100 transition-colors">Physician Sign In</Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-md w-full">
          {!sent ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-7">
              {/* Icon */}
              <div className="h-14 w-14 rounded-full bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center text-brand-teal mx-auto">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>

              {/* Title */}
              <div className="text-center space-y-1.5">
                <h1 className="font-display text-2xl font-black text-white tracking-tight">Forgot Password?</h1>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  Enter your registered email and we'll send a secure reset link with a one-time passcode.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-brand-red/10 border border-brand-red/15 text-brand-red font-bold text-xs rounded-xl">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Account type toggle */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                    Account Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["patient", "doctor"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setUserType(type)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          userType === type
                            ? "bg-brand-teal border-brand-teal text-white shadow-md shadow-brand-teal/20"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {type === "patient" ? "🧑‍⚕️ Patient" : "👨‍⚕️ Physician"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email field */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md shadow-brand-teal/15 disabled:bg-slate-800 disabled:shadow-none flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Sending Reset Link...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>Send Reset Link</span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center">
                <Link
                  href={userType === "doctor" ? "/doctor/signin" : "/signin"}
                  className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
                >
                  ← Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            /* ── Email sent state ── */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-brand-teal/10 border-2 border-brand-teal/30 flex items-center justify-center text-brand-teal mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-2xl font-black text-white tracking-tight">Check Your Inbox</h2>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  If <span className="text-brand-teal font-bold">{email}</span> is registered, you'll receive a reset link with a 6-digit OTP within a few seconds.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-400 leading-relaxed space-y-1.5 text-left">
                <p className="font-bold text-slate-300">Next steps:</p>
                <p>1. Open the email from <span className="text-brand-teal">HealthKo Security</span></p>
                <p>2. Click the <strong className="text-white">Reset My Password</strong> button</p>
                <p>3. Enter the 6-digit OTP from the email</p>
                <p>4. Set your new password</p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  className="block w-full text-center text-xs font-bold text-slate-500 hover:text-brand-teal transition-colors"
                >
                  Didn't receive it? Send again
                </button>
                <Link
                  href={userType === "doctor" ? "/doctor/signin" : "/signin"}
                  className="block text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Return to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-900 py-5 px-6 text-center text-[10px] text-slate-600 font-bold uppercase tracking-wider relative z-10">
        © {new Date().getFullYear()} HealthKo Technologies, Inc. • HIPAA Secure Password Recovery
      </footer>
    </div>
  );
}
