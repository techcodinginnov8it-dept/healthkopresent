"use client";

import Link from "next/link";

export default function FinalCTA() {
  return (
    <section id="final-cta" className="py-16 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* CTA Container */}
        <div className="relative rounded-3xl bg-slate-900 overflow-hidden shadow-2xl p-8 sm:p-12 lg:p-16 border border-slate-800">
          
          {/* Glowing background details */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-teal/25 blur-3xl pointer-events-none -translate-y-24 translate-x-24" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-brand-red/15 blur-3xl pointer-events-none translate-y-24 -translate-x-24" />

          <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
            {/* Tagline */}
            <span className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-white/10 text-brand-teal-tint text-xs sm:text-sm font-semibold select-none border border-white/5 uppercase tracking-wider">
              Ready to experience modern telehealth?
            </span>

            {/* Heading */}
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Take Control of Your Health Journey Today
            </h2>

            {/* Subtext */}
            <p className="text-slate-400 font-medium text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Connect with verified doctors, manage your prescriptions, and securely vault your medical files in minutes. HealthKo makes clinical care accessible anytime.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto text-center bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm px-8 py-4 rounded-full shadow-lg shadow-brand-teal/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                Book Consultation
              </Link>
              <Link
                href="/signup"
                className="w-full sm:w-auto text-center bg-white/10 hover:bg-white/15 text-white font-bold text-sm px-8 py-4 rounded-full border border-white/10 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                Sign Up as Patient
              </Link>
            </div>

            {/* Doctor info ticker */}
            <div className="pt-8 border-t border-white/10 flex flex-wrap justify-center items-center gap-y-3 gap-x-8 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>48 Doctors Online Now</span>
              </div>
              <span className="hidden sm:inline text-white/10">•</span>
              <div className="flex items-center space-x-2">
                <span>Average response time: 8 mins</span>
              </div>
              <span className="hidden sm:inline text-white/10">•</span>
              <div className="flex items-center space-x-2">
                <span>HIPAA & SOC2 Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
