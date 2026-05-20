"use client";

export default function SocialProof() {
  const partners = [
    { name: "ApexCare Health", type: "Hospital Group" },
    { name: "Northwest Medical", type: "Family Clinic" },
    { name: "Vanguard Health", type: "Research Center" },
    { name: "Beacon Diagnostics", type: "Clinical Network" },
    { name: "Helix Pediatrics", type: "Family Care" },
  ];

  const metrics = [
    {
      value: "150+",
      label: "Board-Certified Doctors",
      description: "Available 24/7 across various specialties.",
      iconColor: "text-brand-teal bg-brand-teal-tint",
      svgPath: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-8a4.978 4.978 0 0 1 3.9 1.93M23 21v-2a4 4 0 0 0-3-3.87",
    },
    {
      value: "10k+",
      label: "Monthly Consultations",
      description: "Secure, reliable, and helpful virtual visits.",
      iconColor: "text-brand-red bg-brand-red-tint",
      svgPath: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
    },
    {
      value: "4.9★",
      label: "Average Rating",
      description: "Highly rated by patients on App Store and Play Store.",
      iconColor: "text-amber-500 bg-amber-50",
      svgPath: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.246.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.178 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.05 10.1c-.773-.564-.375-1.81.588-1.81h4.908a1 1 0 00.951-.69l1.519-4.674z",
    },
    {
      value: "99.8%",
      label: "Uptime & Secure SLA",
      description: "Protected by military-grade end-to-end encryption.",
      iconColor: "text-emerald-500 bg-emerald-50",
      svgPath: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
  ];

  return (
    <section className="bg-white py-16 border-y border-slate-100 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Clinic Partner Logos */}
        <div className="text-center space-y-5">
          <p className="text-xs uppercase tracking-widest font-black text-slate-400">
            Trusted by Leading Healthcare Networks
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-75">
            {partners.map((partner, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 grayscale hover:grayscale-0 transition-all duration-300"
              >
                <div className="h-6 w-6 rounded-md bg-brand-teal/10 flex items-center justify-center text-brand-teal font-extrabold text-[10px]">
                  {partner.name.charAt(0)}
                </div>
                <div className="text-left leading-none">
                  <span className="text-slate-800 font-bold text-sm tracking-tight">
                    {partner.name}
                  </span>
                  <span className="block text-[8px] text-slate-400 font-semibold uppercase">
                    {partner.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-20">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-100/70 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div
                  className={`h-12 w-12 rounded-2xl flex items-center justify-center ${metric.iconColor} transition-transform group-hover:scale-105`}
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={metric.svgPath}
                    />
                  </svg>
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-3xl font-black text-slate-900 tracking-tight">
                    {metric.value}
                  </h3>
                  <h4 className="text-slate-800 font-bold text-sm">
                    {metric.label}
                  </h4>
                </div>
              </div>
              <p className="text-slate-500 text-xs font-medium leading-relaxed mt-3">
                {metric.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
