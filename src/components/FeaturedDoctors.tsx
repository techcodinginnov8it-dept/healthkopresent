"use client";

import { useState } from "react";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  status: "Available" | "Busy" | "Offline";
  nextSlot: string;
  avatarBg: string;
  avatarInitials: string;
}

export default function FeaturedDoctors() {
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [symptoms, setSymptoms] = useState("");

  const doctors: Doctor[] = [
    {
      id: "doc1",
      name: "Dr. Sarah Jenkins, MD",
      specialty: "Cardiology Specialist",
      rating: 4.9,
      reviews: 142,
      status: "Available",
      nextSlot: "Immediate",
      avatarBg: "bg-brand-red text-white",
      avatarInitials: "SJ",
    },
    {
      id: "doc2",
      name: "Dr. Ryan Patel, MD",
      specialty: "Endocrinologist",
      rating: 4.8,
      reviews: 98,
      status: "Available",
      nextSlot: "Immediate",
      avatarBg: "bg-brand-teal text-white",
      avatarInitials: "RP",
    },
    {
      id: "doc3",
      name: "Dr. Elena Rostova, MD",
      specialty: "Internal Medicine",
      rating: 5.0,
      reviews: 215,
      status: "Busy",
      nextSlot: "In 15 minutes",
      avatarBg: "bg-indigo-600 text-white",
      avatarInitials: "ER",
    },
    {
      id: "doc4",
      name: "Dr. Marcus Vance, MD",
      specialty: "Family Practitioner",
      rating: 4.9,
      reviews: 87,
      status: "Available",
      nextSlot: "Immediate",
      avatarBg: "bg-slate-800 text-white",
      avatarInitials: "MV",
    },
  ];

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConnectionSuccess(true);
    setTimeout(() => {
      // Close modal and reset state after a delay
      setSelectedDoctor(null);
      setConnectionSuccess(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setSymptoms("");
    }, 4500);
  };

  return (
    <section id="featured-doctors" className="py-24 bg-white relative overflow-hidden">
      {/* Background radial details */}
      <div className="absolute top-10 left-1/3 w-80 h-80 rounded-full bg-brand-teal/5 blur-3xl" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full bg-brand-red/5 blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs uppercase tracking-widest font-black text-brand-teal">
            Meet Our Practitioners
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Consult With Featured Doctors Online Now
          </h2>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">
            Select an active, board-certified physician below to begin a secure consultation session. No advance appointment required.
          </p>
        </div>

        {/* Doctors Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="group p-6 rounded-3xl bg-[#FAFBFD] border border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-2xl hover:shadow-slate-100/80 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-6">
                {/* Doctor Avatar & Status */}
                <div className="flex items-start justify-between">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-extrabold text-lg select-none shadow-md ${doctor.avatarBg}`}>
                    {doctor.avatarInitials}
                  </div>
                  {/* Status Indicator */}
                  <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                    doctor.status === "Available"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : "bg-amber-50 text-amber-600 border border-amber-100"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${doctor.status === "Available" ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                    <span>{doctor.status}</span>
                  </span>
                </div>

                {/* Doctor Details */}
                <div>
                  <h4 className="font-display font-black text-slate-900 text-base group-hover:text-brand-teal transition-colors">
                    {doctor.name}
                  </h4>
                  <p className="text-slate-400 text-xs font-semibold mt-0.5">{doctor.specialty}</p>
                </div>

                {/* Ratings */}
                <div className="flex items-center space-x-2">
                  <div className="flex text-amber-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <span className="text-xs font-black text-slate-800">{doctor.rating}</span>
                  <span className="text-slate-400 text-xs font-medium">({doctor.reviews} consults)</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-4 border-t border-slate-100/50">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400 mb-3.5">
                  <span>Next slot:</span>
                  <span className="text-slate-800 font-extrabold">{doctor.nextSlot}</span>
                </div>
                <button
                  onClick={() => setSelectedDoctor(doctor)}
                  className="w-full text-center bg-slate-900 hover:bg-brand-teal text-white font-bold text-xs py-3 rounded-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 shadow-sm"
                >
                  Quick Connect
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Connection Modal Overlay */}
      {selectedDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
            
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-[#FAFBFD]">
              <div className="flex items-center space-x-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-sm ${selectedDoctor.avatarBg}`}>
                  {selectedDoctor.avatarInitials}
                </div>
                <div>
                  <h3 className="font-display font-black text-slate-950 text-sm">
                    Connect with {selectedDoctor.name}
                  </h3>
                  <p className="text-slate-400 text-xs font-semibold">{selectedDoctor.specialty}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="h-8 w-8 rounded-full flex items-center justify-center border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {!connectionSuccess ? (
                <form onSubmit={handleConnectSubmit} className="space-y-5">
                  {/* Account Selector Tabs */}
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-500">
                    <button
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      className={`py-2 rounded-lg transition-all ${
                        authMode === "signup"
                          ? "bg-white text-brand-teal shadow-sm"
                          : "hover:text-slate-800"
                      }`}
                    >
                      New to HealthKo
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className={`py-2 rounded-lg transition-all ${
                        authMode === "signin"
                          ? "bg-white text-brand-teal shadow-sm"
                          : "hover:text-slate-800"
                      }`}
                    >
                      I have an Account
                    </button>
                  </div>

                  {/* Inputs based on selection */}
                  {authMode === "signup" ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Full Name</label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Jane Doe"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jane.doe@example.com"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Describe your symptoms (Optional)</label>
                        <textarea
                          rows={3}
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          placeholder="Briefly describe what you're experiencing..."
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-brand-teal resize-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jane.doe@example.com"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Password</label>
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-brand-teal"
                        />
                      </div>
                    </div>
                  )}

                  {/* Submission Button */}
                  <button
                    type="submit"
                    className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-xs py-3.5 rounded-xl transition-all duration-300 shadow-md shadow-brand-teal/10 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {authMode === "signup" ? "Create Profile & Connect" : "Sign In & Connect"}
                  </button>
                </form>
              ) : (
                /* Connecting Spinner / Progress Indicator */
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-6 animate-pulse">
                  <div className="h-16 w-16 rounded-full border-4 border-brand-teal/20 border-t-brand-teal animate-spin" />
                  <div className="space-y-2">
                    <h4 className="font-display font-black text-slate-900 text-base">
                      Establishing Secure HIPAA Session...
                    </h4>
                    <p className="text-slate-500 text-xs font-semibold max-w-sm">
                      {authMode === "signup"
                        ? "Registering secure record vault and launching video consulting bridge..."
                        : "Credentials verified! Joining doctor's virtual room..."}
                    </p>
                  </div>
                  <div className="w-full max-w-xs bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand-teal h-1.5 rounded-full animate-progress-bar" style={{ width: '100%', transition: 'width 4s ease-in-out' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!connectionSuccess && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center space-x-2 text-[10px] font-bold text-slate-400">
                <svg className="w-3.5 h-3.5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" />
                </svg>
                <span>End-to-End Encrypted HIPAA Channel</span>
              </div>
            )}

          </div>
        </div>
      )}
    </section>
  );
}
