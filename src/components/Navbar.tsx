"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "py-3 bg-white/85 backdrop-blur-md shadow-md border-b border-slate-100"
          : "py-5 bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-1 select-none">
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
              className="text-slate-600 hover:text-brand-teal focus:outline-none p-2"
              aria-label="Toggle Menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-100 shadow-xl transition-all duration-300 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-5 pointer-events-none"
        }`}
      >
        <div className="px-4 pt-2 pb-6 space-y-3 sm:px-3">
          <Link
            href="#features"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-brand-teal-tint hover:text-brand-teal transition-colors"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-brand-teal-tint hover:text-brand-teal transition-colors"
          >
            How it Works
          </Link>
          <Link
            href="#dashboard-preview"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-brand-teal-tint hover:text-brand-teal transition-colors"
          >
            Live Demo
          </Link>
          <Link
            href="#testimonials"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-brand-teal-tint hover:text-brand-teal transition-colors"
          >
            Testimonials
          </Link>
          <Link
            href="#faq"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-brand-teal-tint hover:text-brand-teal transition-colors"
          >
            FAQ
          </Link>
          <div className="pt-4 border-t border-slate-100 flex flex-col space-y-3 px-3">
            <Link
              href="/signin"
              onClick={() => setIsOpen(false)}
              className="text-center font-bold text-slate-700 hover:text-brand-teal py-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="#final-cta"
              onClick={() => setIsOpen(false)}
              className="bg-brand-teal text-white font-bold px-5 py-3 rounded-full text-center shadow-lg shadow-brand-teal/20 hover:bg-brand-teal-hover transition-colors"
            >
              Book Consultation
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
