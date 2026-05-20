"use client";

import { useState } from "react";
import Link from "next/link";
import { loginPatient } from "../actions/auth";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await loginPatient({ email, password });
      setLoading(false);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || "Invalid email or password");
      }
    } catch (err: any) {
      setLoading(false);
      setError("A network error occurred. Please verify your connection.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-white font-sans text-slate-800">
      
      {/* Left Column: Brand & Trust Messages (5 cols) */}
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
        </Link>

        {/* Motivation Message */}
        <div className="space-y-6 relative z-10 max-w-sm">
          <h1 className="font-display text-3xl font-black tracking-tight leading-tight">
            Your Premium Health Vault Awaits
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            Access secure virtual consultation sessions, direct pharmacy refills, and clinical trend tracking using our state-of-the-art telehealth system.
          </p>
          <div className="pt-6 border-t border-slate-850 flex items-center space-x-3 text-xs text-slate-400 font-bold">
            <svg className="w-5 h-5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Fully HIPAA & SOC2 Compliant Encryption</span>
          </div>
        </div>

        {/* Copyright */}
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider relative z-10">
          © {new Date().getFullYear()} HealthKo Technologies, Inc.
        </span>
      </div>

      {/* Right Column: Sign In Form (7 cols) */}
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
            <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Sign In to Patient Portal
            </h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm">
              Enter your verified credentials to access your secure medical vault.
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-brand-red/10 border border-brand-red/20 text-brand-red font-bold text-xs rounded-xl animate-fade-in">
                  {error}
                </div>
              )}
              
              {/* Email Address */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane.doe@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    href="#"
                    className="text-[10px] font-bold text-brand-teal hover:text-brand-teal-hover"
                  >
                    Forgot Password?
                  </Link>
                </div>
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

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember-me"
                  className="h-4 w-4 rounded border-slate-350 text-brand-teal focus:ring-brand-teal/20"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs font-bold text-slate-500 select-none">
                  Keep me logged in for 30 days
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md shadow-brand-teal/10 hover:-translate-y-0.5 active:translate-y-0 disabled:bg-slate-300 disabled:translate-y-0 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Authenticating Vault...</span>
                  </>
                ) : (
                  <span>Access Secure Dashboard</span>
                )}
              </button>
            </form>
          ) : (
            /* Success Feedback / Redirect Simulation */
            <div className="py-8 text-center space-y-6 animate-fade-in">
              <div className="h-16 w-16 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-emerald-500 mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-slate-900 text-lg">
                  Authenticated Successfully
                </h3>
                <p className="text-slate-500 text-sm font-semibold max-w-xs mx-auto leading-relaxed">
                  Decrypted credentials and mapped clinical vault tokens. Redirecting to your medical panel...
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
            <div className="text-center text-xs font-semibold text-slate-500 pt-4 space-y-2">
              <div>
                <span>New to HealthKo? </span>
                <Link href="/signup" className="text-brand-teal hover:text-brand-teal-hover font-extrabold underline">
                  Create a secure patient profile
                </Link>
              </div>
              <div className="pt-1 border-t border-slate-100">
                <span>Are you a medical practitioner? </span>
                <Link href="/doctor/signin" className="text-slate-850 hover:text-brand-teal font-extrabold underline">
                  Sign in to Doctor Portal
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
      
    </div>
  );
}
