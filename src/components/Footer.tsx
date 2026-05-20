"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 pt-16 pb-8 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top footer content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-850">
          
          {/* Brand & Bio (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <Link href="/" className="flex items-center space-x-1 select-none">
              <span className="font-display text-2xl tracking-tight">
                <span className="text-brand-red font-black">H</span>
                <span className="text-white font-extrabold">ealth</span>
                <span className="text-brand-teal font-black">K</span>
                <span className="text-white font-extrabold">o</span>
              </span>
            </Link>
            <p className="text-xs sm:text-sm font-medium leading-relaxed max-w-sm">
              Next-generation virtual healthcare platform providing 24/7 online doctor consultations, certified e-prescriptions, and a secure HIPAA-compliant records vault.
            </p>
            <div className="flex space-x-4">
              {/* Twitter / X */}
              <Link href="#" className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-brand-teal hover:text-white flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Link>
              {/* LinkedIn */}
              <Link href="#" className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-brand-teal hover:text-white flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </Link>
              {/* Facebook */}
              <Link href="#" className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-brand-teal hover:text-white flex items-center justify-center transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1V12h3v3h-3v6.8c4.56-.93 8-4.96 8-9.8z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Spacer for structure */}
          <div className="hidden lg:block lg:col-span-1" />

          {/* Links Column 1: Product (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-white font-extrabold text-sm uppercase tracking-wider">Product</h4>
            <ul className="space-y-2.5 text-xs font-semibold">
              <li>
                <Link href="#features" className="hover:text-white transition-colors">Platform Features</Link>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-white transition-colors">How It Works</Link>
              </li>
              <li>
                <Link href="#dashboard-preview" className="hover:text-white transition-colors">Interactive Demo</Link>
              </li>
              <li>
                <Link href="#why-choose-us" className="hover:text-white transition-colors">Clinical Standards</Link>
              </li>
              <li>
                <Link href="/doctor/signin" className="text-brand-teal hover:text-brand-teal-hover transition-colors font-bold">Practitioner Portal</Link>
              </li>
            </ul>
          </div>

          {/* Links Column 2: Legal & HIPAA (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-white font-extrabold text-sm uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2.5 text-xs font-semibold">
              <li>
                <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">HIPAA Privacy Rule</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">Consent to Treat</Link>
              </li>
            </ul>
          </div>

          {/* Links Column 3: Contact & Address (3 cols) */}
          <div className="lg:col-span-3 space-y-4 text-xs font-semibold">
            <h4 className="text-white font-extrabold text-sm uppercase tracking-wider">Contact & Support</h4>
            <ul className="space-y-3">
              <li className="flex items-center space-x-2.5">
                <svg className="w-4 h-4 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-slate-300">support@healthko.com</span>
              </li>
              <li className="flex items-center space-x-2.5">
                <svg className="w-4 h-4 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-slate-300">1-800-555-KARE</span>
              </li>
              <li className="flex items-start space-x-2.5">
                <svg className="w-4 h-4 text-brand-teal flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-slate-300 leading-normal">
                  HealthKo Technologies, Inc.<br />
                  123 Care Street, Suite 400<br />
                  San Francisco, CA 94103
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Legal Emergency Medical Disclaimer & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row justify-between items-center text-[10px] sm:text-xs font-semibold text-slate-500 space-y-4 md:space-y-0 leading-normal">
          <div className="max-w-2xl text-center md:text-left">
            <span className="font-extrabold text-slate-400 block mb-1">EMERGENCY MEDICAL DISCLAIMER:</span>
            <span>
              If you are experiencing a life-threatening medical emergency, please dial 911 or proceed to the nearest emergency room immediately. HealthKo is a virtual consultations platform; it is not an emergency response service and should not be used for urgent cardiac or stroke responses.
            </span>
          </div>
          <div className="flex-shrink-0 text-center md:text-right font-black">
            <span>© {currentYear} HealthKo Technologies, Inc. All rights reserved.</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
