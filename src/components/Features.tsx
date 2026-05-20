"use client";

export default function Features() {
  const featureList = [
    {
      title: "Online Consultations",
      description: "Immediate access to virtual visits with specialized medical staff from the comfort of your home.",
      iconColor: "text-brand-red bg-brand-red-tint border-brand-red/10",
      accentColor: "group-hover:text-brand-red",
      badge: "24/7 Access",
      svg: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10.5V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9.5m14 0a2 2 0 0 0-2-2h-3v-3a2 2 0 0 0-2-2h-3a2 2 0 0 0-2 2v3H7a2 2 0 0 0-2 2m14 0V9a2 2 0 0 0-2-2M5 10.5V9a2 2 0 0 1 2-2" />
        </svg>
      ),
    },
    {
      title: "Secure Medical Records",
      description: "Your electronic health file is encrypted and saved under compliance standards. Easily share with clinics.",
      iconColor: "text-brand-teal bg-brand-teal-tint border-brand-teal/10",
      accentColor: "group-hover:text-brand-teal",
      badge: "HIPAA Compliant",
      svg: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" />
        </svg>
      ),
    },
    {
      title: "Appointment Scheduling",
      description: "Select your preferred practitioner, view open slots, and schedule a consult with immediate synchronization.",
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-100",
      accentColor: "group-hover:text-indigo-600",
      badge: "Auto Sync",
      svg: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
        </svg>
      ),
    },
    {
      title: "Video Consultations",
      description: "Experience HD, peer-to-peer encrypted video calling directly from your web browser. No download required.",
      iconColor: "text-brand-red bg-brand-red-tint border-brand-red/10",
      accentColor: "group-hover:text-brand-red",
      badge: "HD Encypted",
      svg: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "Prescription Tracking",
      description: "Receive signed pharmacy-ready e-prescriptions instantly. Send to your local store or choose home delivery.",
      iconColor: "text-brand-teal bg-brand-teal-tint border-brand-teal/10",
      accentColor: "group-hover:text-brand-teal",
      badge: "Auto-Refills",
      svg: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Health Analytics",
      description: "Monitor vitals, sync wearable devices, and display trends to detect anomalies before they become critical.",
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
      accentColor: "group-hover:text-emerald-600",
      badge: "Real-Time",
      svg: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="features" className="py-24 bg-[#FAFBFD] relative overflow-hidden">
      {/* Background soft layout colors */}
      <div className="absolute top-1/2 left-0 w-80 h-80 rounded-full bg-brand-teal/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
          <h2 className="text-xs uppercase tracking-widest font-black text-brand-teal">
            Comprehensive Telehealth Platform
          </h2>
          <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Designed for Modern Healthcare Delivery
          </h3>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">
            HealthKo brings together essential resources for consultations, records, and prescriptions into a unified, secure portal for patients and providers.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featureList.map((feature, index) => (
            <div
              key={index}
              className="group relative p-8 rounded-3xl bg-white border border-slate-100/80 shadow-xl shadow-slate-100/50 hover:shadow-2xl hover:shadow-slate-100 hover:border-slate-200 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-6">
                {/* Icon header with badge */}
                <div className="flex items-center justify-between">
                  <div
                    className={`h-12 w-12 rounded-2xl flex items-center justify-center border ${feature.iconColor} transition-transform duration-300 group-hover:scale-110`}
                  >
                    {feature.svg}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md uppercase">
                    {feature.badge}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h4 className={`font-display text-xl font-extrabold text-slate-900 transition-colors ${feature.accentColor}`}>
                    {feature.title}
                  </h4>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>

              {/* Card Footer action button */}
              <div className="mt-8 pt-4 border-t border-slate-50 flex items-center text-slate-400 group-hover:text-brand-teal transition-colors text-xs font-bold uppercase tracking-wider">
                <span>Learn More</span>
                <svg
                  className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
