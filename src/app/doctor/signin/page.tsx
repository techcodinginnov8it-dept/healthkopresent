"use client";

import { useState } from "react";
import Link from "next/link";

export default function DoctorSignInPage() {
  const [emailOrNpi, setEmailOrNpi] = useState("");
  const [password, setPassword] = useState("");
  const [securityKey, setSecurityKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
    }, 2000);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-white font-sans text-slate-800">
      
      {/* Left Column: Doctor Branding & Key metrics (5 cols) */}
      <div className="hidden lg:flex lg:col-span-5 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-80 h-80 rounded-full bg-brand-teal/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-brand-red/10 blur-3xl" />

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-1 select-none relative z-10">
          <span className="font-display text-2xl tracking-tight">
            <span className="text-brand-red font-black">H</span>
            <span className="text-white font-extrabold">ealth</span>
            <span className="text-brand-teal font-black">K</span>
            <span className="text-white font-extrabold">o</span>
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded ml-2 tracking-wider">
            CLINIC
          </span>
        </Link>

        {/* Doctor Features */}
        <div className="space-y-6 relative z-10 max-w-sm">
          <h1 className="font-display text-3xl font-black tracking-tight leading-tight">
            Orchestrate Your Digital Practice
          </h1>
          <p className="text-slate-450 text-sm font-medium leading-relaxed">
            Access your patient queues, write e-prescriptions directly, review telemetry graphs, and start encrypted high-definition consult sessions instantly.
          </p>

          <div className="space-y-4 pt-6 border-t border-slate-850 text-xs font-bold text-slate-400">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
              </svg>
              <span>NPI Credentials Authenticated</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
              </svg>
              <span>State-license Vaulted Sessions</span>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider relative z-10">
          © {new Date().getFullYear()} HealthKo Technologies, Inc.
        </span>
      </div>

      {/* Right Column: Practitioner Login Form (7 cols) */}
      <div className="col-span-12 lg:col-span-7 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 relative">
        {/* Mobile Header Logo */}
        <div className="absolute top-8 left-8 lg:hidden">
          <Link href="/" className="flex items-center space-x-1">
            <span className="font-display text-xl tracking-tight">
              <span className="text-brand-red font-black">H</span>
              <span className="text-slate-900 font-extrabold">ealth</span>
              <span className="text-brand-teal font-black">K</span>
              <span className="text-slate-900 font-extrabold">o</span>
            </span>
          </Link>
        </div>

        <div className="max-w-md w-full mx-auto space-y-8">
          
          {/* Form Header */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-brand-red uppercase bg-brand-red-tint/10 border border-brand-red/10 px-2 py-0.5 rounded tracking-wider">
              Practitioner Portal
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-1">
              Physician Sign In
            </h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm">
              Enter your clinical email or 10-digit NPI number to enter your medical workspace.
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Email / NPI */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                  NPI Number or Email
                </label>
                <input
                  type="text"
                  required
                  value={emailOrNpi}
                  onChange={(e) => setEmailOrNpi(e.target.value)}
                  placeholder="e.g. 1982736450 or name@clinic.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
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

              {/* Security Key / Passcode (Clinical 2FA) */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                  2FA Secure Passcode (SMS or Authenticator)
                </label>
                <input
                  type="text"
                  required
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  placeholder="e.g. 102938"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-brand-teal text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:bg-slate-350 disabled:translate-y-0 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying Licensure...</span>
                  </>
                ) : (
                  <span>Access Clinical Console</span>
                )}
              </button>
            </form>
          ) : (
            /* Success Feedback / Redirect Simulation */
            <div className="py-8 text-center space-y-6 animate-pulse">
              <div className="h-16 w-16 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-emerald-500 mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-slate-900 text-lg">
                  Clinical License Verified
                </h3>
                <p className="text-slate-500 text-sm font-semibold max-w-xs mx-auto leading-relaxed">
                  Decrypted state medical logs. Syncing practitioner consult panel and video connection buffers...
                </p>
              </div>
              <div className="w-full max-w-xs mx-auto bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-teal h-1.5 rounded-full animate-progress-bar" style={{ width: '100%', transition: 'width 2s ease-in-out' }} />
              </div>
              <div className="pt-4">
                <Link
                  href="/"
                  className="text-xs font-black text-brand-teal hover:underline"
                >
                  Return to Homepage
                </Link>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          {!success && (
            <div className="text-center text-xs font-semibold text-slate-500 pt-4 space-y-1 flex flex-col">
              <div>
                <span>Are you a patient? </span>
                <Link href="/signin" className="text-brand-teal hover:text-brand-teal-hover font-extrabold underline">
                  Sign in to patient portal
                </Link>
              </div>
              <div className="pt-1">
                <span>Want to join the network? </span>
                <Link href="#" className="text-slate-700 hover:text-brand-teal font-extrabold underline">
                  Submit credentials audit
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
      
    </div>
  );
}
