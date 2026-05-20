"use client";

import { useState } from "react";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqs = [
    {
      question: "Are the doctors on HealthKo board-certified?",
      answer: "Yes, 100% of our medical practitioners are fully licensed, board-certified, and undergo a rigorous credentials verification process and background check prior to joining the HealthKo network.",
    },
    {
      question: "Is my medical data secure and HIPAA-compliant?",
      answer: "Absolutely. HealthKo is designed from the ground up to comply with all HIPAA regulations. All communications are encrypted end-to-end, and your files are stored in our secure, decentralized health vault protected by AES-256 standard encryption.",
    },
    {
      question: "Can I get prescriptions refilled through HealthKo?",
      answer: "Yes. Following a video consultation, your doctor can issue a digitally signed e-prescription directly to your local pharmacy. You can track your active prescriptions and request refills through the patient portal.",
    },
    {
      question: "How much does a video consultation cost?",
      answer: "We offer clear, transparent pricing. If you are uninsured or out-of-network, consults start at a flat rate of $49. There are no hidden facility fees or surprise charges. You will always see the price before you book.",
    },
    {
      question: "Does HealthKo support health insurance?",
      answer: "Yes, we partner with most major insurance networks. During profile setup, you can upload your insurance card. We will automatically calculate and display your co-pay amount prior to scheduling your visit.",
    },
  ];

  return (
    <section id="faq" className="py-24 bg-[#FAFBFD] relative overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute top-1/2 left-0 w-80 h-80 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-brand-teal/5 blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs uppercase tracking-widest font-black text-brand-red">
            Frequently Asked Questions
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Got Questions? We Have Answers
          </h2>
          <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-xl mx-auto">
            Find out everything you need to know about our virtual consultations, security compliance standards, and pricing systems.
          </p>
        </div>

        {/* Accordions */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-slate-100/80 bg-white shadow-md shadow-slate-100/50 hover:border-slate-200 transition-all duration-300 overflow-hidden"
              >
                {/* Accordion Trigger Button */}
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full flex items-center justify-between p-6 text-left font-display font-bold text-slate-800 hover:text-brand-teal transition-colors focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="text-sm sm:text-base pr-4">{faq.question}</span>
                  <span className={`h-8 w-8 rounded-full flex items-center justify-center bg-slate-50 border border-slate-100 flex-shrink-0 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180 text-brand-teal bg-brand-teal-tint/20 border-brand-teal/20" : ""}`}>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </span>
                </button>

                {/* Accordion Content Panel */}
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isOpen ? "max-h-[200px] border-t border-slate-50" : "max-h-0 pointer-events-none"
                  }`}
                >
                  <div className="p-6 text-xs sm:text-sm text-slate-500 font-medium leading-relaxed bg-[#FAFBFD]">
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
