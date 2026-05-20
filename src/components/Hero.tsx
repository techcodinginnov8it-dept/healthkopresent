"use client";

import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-b from-[#F2F7FA] via-white to-white">
      {/* Background visual shapes */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-30 pointer-events-none hidden lg:block">
        <div className="absolute -top-20 -right-20 w-[600px] h-[600px] rounded-full bg-brand-teal/10 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-brand-red/5 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-6 space-y-8 text-center lg:text-left animate-slide-up">
            {/* Tagline */}
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-brand-teal-tint border border-brand-teal/10 text-brand-teal text-xs sm:text-sm font-semibold select-none">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-teal opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-teal"></span>
              </span>
              <span>Next-Gen Virtual Healthcare Platform</span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight sm:leading-none">
              Healthcare <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-teal to-brand-teal/80">Anywhere, </span>
              <span className="text-brand-red">Anytime.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-slate-600 text-lg sm:text-xl max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
              Connect with top-tier board-certified doctors in minutes. Get online consultations, secure medical files, and direct pharmacy-ready prescriptions.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto text-center bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-base px-8 py-4 rounded-full shadow-xl shadow-brand-teal/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                Book Consultation
              </Link>
              <Link
                href="#dashboard-preview"
                className="w-full sm:w-auto text-center bg-white hover:bg-slate-50 text-slate-700 font-bold text-base px-8 py-4 rounded-full border border-slate-200 shadow-md shadow-slate-100/50 transition-all duration-300 hover:border-slate-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                Explore Dashboard
              </Link>
            </div>

            {/* Micro proof badges */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap justify-center lg:justify-start gap-y-3 gap-x-8 text-slate-500 text-sm">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold text-slate-700">100% Secure & HIPAA Compliant</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-brand-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold text-slate-700">24/7 Physician Availability</span>
              </div>
            </div>
          </div>

          {/* Right Visual Column (Floating SaaS UI Mockup) */}
          <div className="lg:col-span-6 relative flex justify-center items-center lg:pl-8">
            <div className="relative w-full max-w-[520px] aspect-[4/3] rounded-3xl bg-slate-900/5 p-2 shadow-2xl ring-1 ring-slate-900/10 overflow-visible bg-gradient-to-tr from-brand-teal/20 to-brand-red/10 animate-fade-in">
              {/* Central App Mockup Canvas */}
              <div className="w-full h-full rounded-2xl bg-white shadow-inner border border-white/60 p-4 relative overflow-hidden flex flex-col justify-between">
                {/* Header of mock app */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="h-3 w-3 rounded-full bg-brand-red" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400" />
                    <span className="h-3 w-3 rounded-full bg-brand-teal" />
                    <span className="ml-2 font-display font-bold text-xs text-slate-400 uppercase tracking-widest">HealthKo Portal</span>
                  </div>
                  <div className="h-2 w-16 rounded-full bg-slate-100" />
                </div>

                {/* Body of mock app */}
                <div className="grid grid-cols-12 gap-3 py-3 flex-1">
                  {/* Left column in mockup - stats */}
                  <div className="col-span-7 space-y-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Active Vitals</div>
                      <div className="text-slate-800 font-extrabold text-lg mt-1 flex items-baseline">
                        72 <span className="text-xs font-semibold text-slate-500 ml-1">BPM</span>
                        <span className="ml-auto text-[10px] font-bold text-green-500 bg-green-50 px-1.5 py-0.5 rounded-md">Normal</span>
                      </div>
                      {/* Heartbeat pulse wave SVG */}
                      <svg className="w-full h-8 text-brand-red mt-2" viewBox="0 0 100 30" fill="none">
                        <path
                          d="M0,15 L30,15 L35,5 L40,25 L45,15 L50,15 L55,0 L60,30 L65,15 L70,15 L100,15"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">Next Consult</div>
                        <div className="text-slate-800 font-extrabold text-sm mt-0.5">Dr. Sarah Jenkins</div>
                      </div>
                      <span className="h-8 w-8 rounded-full bg-brand-teal-tint border border-brand-teal/20 text-brand-teal font-extrabold text-xs flex items-center justify-center">
                        SJ
                      </span>
                    </div>
                  </div>

                  {/* Right column in mockup - visual representation */}
                  <div className="col-span-5 flex flex-col justify-between">
                    <div className="p-3 rounded-xl bg-brand-teal text-white flex-1 flex flex-col justify-between shadow-lg shadow-brand-teal/15">
                      <div className="text-[10px] opacity-75 font-semibold">Online Doctors</div>
                      <div className="font-display font-black text-2xl">48+</div>
                      <div className="text-[9px] opacity-90 leading-tight">Ready for video consultation now.</div>
                    </div>
                  </div>
                </div>

                {/* Footer of mock app */}
                <div className="h-3 w-full rounded-full bg-slate-50 mt-auto flex items-center px-2">
                  <div className="h-1.5 w-1/4 rounded-full bg-slate-200" />
                </div>
              </div>

              {/* Floating Widget 1: Video Consult Bubble */}
              <div className="absolute -top-6 -right-6 glass p-3.5 rounded-2xl shadow-xl border border-white flex items-center space-x-3 w-[220px] animate-float">
                <div className="relative">
                  <div className="h-10 w-10 rounded-xl bg-brand-red-tint flex items-center justify-center text-brand-red">
                    {/* Camera icon */}
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-red"></span>
                  </span>
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-800 leading-tight">Video Consultation</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Connected • 08:42</div>
                </div>
              </div>

              {/* Floating Widget 2: Prescriptions Issued badge */}
              <div className="absolute -bottom-6 -left-8 glass p-3 rounded-2xl shadow-xl border border-white flex items-center space-x-3 w-[200px] animate-float" style={{ animationDelay: "1.5s" }}>
                <div className="h-10 w-10 rounded-xl bg-brand-teal-tint flex items-center justify-center text-brand-teal">
                  {/* Document check icon */}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-800 leading-tight">e-Prescription</div>
                  <div className="text-[10px] font-bold text-brand-teal mt-0.5">Verified & Signed</div>
                </div>
              </div>

              {/* Floating Widget 3: Small stats circle */}
              <div className="absolute bottom-12 -right-8 glass h-14 w-14 rounded-full shadow-lg border border-white flex flex-col items-center justify-center leading-none animate-float" style={{ animationDelay: "2.5s" }}>
                <span className="text-[10px] font-extrabold text-slate-400">RATING</span>
                <span className="text-sm font-black text-slate-800 mt-0.5">4.9★</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
