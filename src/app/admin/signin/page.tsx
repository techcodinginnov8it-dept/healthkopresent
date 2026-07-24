"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AdminSignInForm() {
  const searchParams = useSearchParams();
  const hasError = searchParams.get("error") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-white font-sans text-slate-800">
      <div className="hidden lg:flex lg:col-span-5 bg-slate-950 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 rounded-full bg-brand-red/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-brand-teal/15 blur-3xl" />

        <Link href="/" className="flex items-center space-x-1 select-none relative z-10">
          <span className="font-display text-2xl tracking-tight">
            <span className="text-brand-red font-black">H</span>
            <span className="text-white font-extrabold">ealth</span>
            <span className="text-brand-teal font-black">K</span>
            <span className="text-white font-extrabold">o</span>
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded ml-2 tracking-wider">
            ADMIN
          </span>
        </Link>

        <div className="space-y-6 relative z-10 max-w-sm">
          <h1 className="font-display text-3xl font-black tracking-tight leading-tight">
            Control Center for Operations
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            Review platform health, manage access, and monitor the clinic workspace from one secure admin console.
          </p>
          <div className="pt-6 border-t border-slate-850 flex items-center space-x-3 text-xs text-slate-400 font-bold">
            <svg className="w-5 h-5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Restricted administrative access</span>
          </div>
        </div>

        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider relative z-10">
          Copyright {new Date().getFullYear()} HealthKo Technologies, Inc.
        </span>
      </div>

      <div className="col-span-12 lg:col-span-7 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 relative">
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
          <div className="space-y-2">
            <span className="text-[10px] font-black text-brand-red uppercase bg-brand-red-tint/10 border border-brand-red/10 px-2 py-0.5 rounded tracking-wider">
              Admin Portal
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-1">
              Admin Sign In
            </h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm">
              Use your admin credentials to access the management dashboard.
            </p>
          </div>

          <form action="/api/admin/login" method="post" className="space-y-5">
            {hasError && (
              <div className="p-3 bg-brand-red/10 border border-brand-red/20 text-brand-red font-bold text-xs rounded-xl animate-fade-in">
                Invalid admin credentials. Please try again.
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@healthko.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[10px] font-bold text-brand-teal hover:text-brand-teal-hover hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="HkAdmin@2026!"
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

            <button
              type="submit"
              className="w-full bg-slate-950 hover:bg-brand-teal text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              Access Admin Console
            </button>
          </form>

          <div className="text-center text-xs font-semibold text-slate-500 pt-4 space-y-2">
            <div>
              <span>Need patient access? </span>
              <Link href="/signin" className="text-brand-teal hover:text-brand-teal-hover font-extrabold underline">
                Sign in to Patient Portal
              </Link>
            </div>
            <div>
              <span>Need doctor access? </span>
              <Link href="/doctor/signin" className="text-slate-850 hover:text-brand-teal font-extrabold underline">
                Sign in to Doctor Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/40">
            <div className="animate-pulse space-y-4">
              <div className="h-3 w-32 rounded bg-slate-800" />
              <div className="h-8 w-72 rounded bg-slate-800" />
              <div className="h-4 w-56 rounded bg-slate-800" />
              <div className="h-12 rounded-xl bg-slate-800" />
              <div className="h-12 rounded-xl bg-slate-800" />
            </div>
          </div>
        </div>
      }
    >
      <AdminSignInForm />
    </Suspense>
  );
}
