"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || isOpen
          ? "py-3 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100"
          : "py-5 bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-1 select-none focus:outline-none focus:ring-2 focus:ring-brand-teal/20 rounded-lg p-1">
            <span className="font-display text-2xl tracking-tight">
              <span className="text-brand-red font-black">H</span>
              <span className="text-slate-800 font-extrabold">ealth</span>
              <span className="text-brand-teal font-black">K</span>
              <span className="text-slate-800 font-extrabold">o</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-slate-600 hover:text-brand-teal font-medium text-sm transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-slate-600 hover:text-brand-teal font-medium text-sm transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="#dashboard-preview"
              className="text-slate-600 hover:text-brand-teal font-medium text-sm transition-colors"
            >
              Live Demo
            </Link>
            <Link
              href="#testimonials"
              className="text-slate-600 hover:text-brand-teal font-medium text-sm transition-colors"
            >
              Testimonials
            </Link>
            <Link
              href="#faq"
              className="text-slate-600 hover:text-brand-teal font-medium text-sm transition-colors"
            >
              FAQ
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/signin"
              className="text-slate-700 hover:text-brand-teal font-semibold text-sm transition-colors px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="#final-cta"
              className="bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-lg shadow-brand-teal/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
            >
              Book Consultation
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-700 hover:text-brand-teal focus:outline-none p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-slate-100 transition-colors"
              aria-label="Toggle Menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 top-[61px] bg-slate-950/40 backdrop-blur-xs md:hidden z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu */}
      <div
        className={`md:hidden absolute top-full left-0 right-0 bg-white/98 backdrop-blur-xl border-b border-slate-200/80 shadow-2xl transition-all duration-300 z-50 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="px-5 pt-3 pb-6 space-y-2 sm:px-6 max-h-[calc(100vh-80px)] overflow-y-auto">
          <Link
            href="#features"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-brand-teal-tint/80 hover:text-brand-teal transition-all active:scale-[0.99]"
          >
            <span>Features</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="#how-it-works"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-brand-teal-tint/80 hover:text-brand-teal transition-all active:scale-[0.99]"
          >
            <span>How it Works</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="#dashboard-preview"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-brand-teal-tint/80 hover:text-brand-teal transition-all active:scale-[0.99]"
          >
            <span>Live Demo</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="#testimonials"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-brand-teal-tint/80 hover:text-brand-teal transition-all active:scale-[0.99]"
          >
            <span>Testimonials</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="#faq"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold text-slate-800 hover:bg-brand-teal-tint/80 hover:text-brand-teal transition-all active:scale-[0.99]"
          >
            <span>FAQ</span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <div className="pt-4 border-t border-slate-100 flex flex-col space-y-3 px-1">
            <Link
              href="/signin"
              onClick={() => setIsOpen(false)}
              className="w-full text-center font-bold text-slate-700 hover:text-brand-teal py-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 transition-all active:scale-[0.99]"
            >
              Sign In
            </Link>
            <Link
              href="#final-cta"
              onClick={() => setIsOpen(false)}
              className="w-full bg-brand-teal text-white font-bold px-5 py-3.5 rounded-xl text-center shadow-lg shadow-brand-teal/25 hover:bg-brand-teal-hover transition-all active:scale-[0.99]"
            >
              Book Consultation
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
