"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutDoctor } from "@/app/actions/auth";
import { acceptAppointment, cancelAppointment, completeConsultation } from "@/app/actions/doctor";

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string | null;
  emailVerified: boolean;
};

type Booking = {
  id: string;
  scheduledAt: Date;
  status: string;
  reason: string | null;
  notes: string | null;
  prescription: string | null;
  duration: number | null;
  createdAt: Date;
  patient: Patient;
};

type Doctor = {
  id: string;
  name: string;
  email: string;
  npi: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  availability: string;
  isVerified: boolean;
  createdAt: Date;
  bookings: Booking[];
};

type DoctorDashboardClientProps = {
  doctor: Doctor;
};

export default function DoctorDashboardClient({ doctor }: DoctorDashboardClientProps) {
  // Tabs: 'overview' | 'patients' | 'schedule' | 'telehealth'
  const [activeTab, setActiveTab] = useState<"overview" | "patients" | "schedule" | "telehealth">("overview");

  // Telehealth / Clinical workspace state
  const [activeCallBooking, setActiveCallBooking] = useState<Booking | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [callStatus, setCallStatus] = useState<"waiting" | "connected" | "ended">("waiting");
  
  // Clinical notes editor states
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [diagnosisText, setDiagnosisText] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Chat states
  const [chatMessages, setChatMessages] = useState<{ sender: "patient" | "doctor"; text: string; time: string }[]>([
    { sender: "patient", text: "Hello doctor, I am in the waiting room and ready.", time: "Just now" },
  ]);
  const [newMsg, setNewMsg] = useState("");

  // Schedule Management loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Helpers
  function formatDate(dateInput: any) {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatDateTime(dateInput: any) {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  // Filter Bookings
  const pendingAppointments = doctor.bookings.filter((b) => b.status === "PENDING");
  const confirmedAppointments = doctor.bookings.filter(
    (b) => b.status === "CONFIRMED" && new Date(b.scheduledAt) >= new Date()
  );
  const completedConsultations = doctor.bookings.filter((b) => b.status === "COMPLETED");

  // Get distinct patients for Patient Management
  const patientMap = new Map<string, Patient>();
  doctor.bookings.forEach((b) => {
    patientMap.set(b.patient.id, b.patient);
  });
  const patientsList = Array.from(patientMap.values());

  // Handle Accept Appointment
  const handleAccept = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await acceptAppointment(id);
      if (res.success) {
        alert("Appointment successfully confirmed!");
        window.location.reload();
      } else {
        alert(res.error || "Failed to accept appointment.");
      }
    } catch (err) {
      alert("Network connection error.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Cancel Appointment
  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to decline/cancel this appointment slot?")) return;
    setActionLoadingId(id);
    try {
      const res = await cancelAppointment(id);
      if (res.success) {
        alert("Appointment successfully cancelled.");
        window.location.reload();
      } else {
        alert(res.error || "Failed to cancel appointment.");
      }
    } catch (err) {
      alert("Network connection error.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Complete Consultation
  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCallBooking) return;
    if (!clinicalNotes || !prescriptionText) {
      setSubmitError("Please fill out both clinical notes and prescription fields.");
      return;
    }

    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const res = await completeConsultation({
        consultationId: activeCallBooking.id,
        notes: clinicalNotes,
        prescription: prescriptionText,
        reason: diagnosisText || undefined,
      });

      setSubmitLoading(false);
      if (res.success) {
        setSubmitSuccess("Clinical notes and e-prescription successfully uploaded and logged!");
        setCallStatus("ended");
        setTimeout(() => {
          setActiveCallBooking(null);
          setClinicalNotes("");
          setPrescriptionText("");
          setDiagnosisText("");
          setActiveTab("overview");
          window.location.reload();
        }, 1500);
      } else {
        setSubmitError(res.error || "Failed to submit clinical encounter data.");
      }
    } catch (err) {
      setSubmitLoading(false);
      setSubmitError("Database transmission error. Please verify database availability.");
    }
  };

  // Start virtual consult session
  const startTelehealth = (booking: Booking) => {
    setActiveCallBooking(booking);
    setCallStatus("waiting");
    setActiveTab("telehealth");
    setClinicalNotes("");
    setPrescriptionText("");
    setDiagnosisText(booking.reason || "");
    
    // Simulate patient entering after 2 seconds
    setTimeout(() => {
      setCallStatus("connected");
      setChatMessages(prev => [
        ...prev,
        { sender: "patient", text: "Hello Doctor, thank you for joining. I can hear and see you well.", time: "10:04 AM" }
      ]);
    }, 3000);
  };

  // Send message
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { sender: "doctor", text: newMsg, time: "Just now" },
    ]);
    const docText = newMsg;
    setNewMsg("");

    // Simulate patient replying after a short delay
    setTimeout(() => {
      let patientResponse = "Okay, understood. I am ready to follow your guidelines.";
      if (docText.toLowerCase().includes("prescription") || docText.toLowerCase().includes("medication")) {
        patientResponse = "Thank you doctor. Will I be able to download the Rx file from my portal dashboard immediately?";
      } else if (docText.toLowerCase().includes("symptom") || docText.toLowerCase().includes("cough")) {
        patientResponse = "Yes, it is mostly dry and gets worse in the evening, which makes it hard to sleep.";
      }
      setChatMessages((prev) => [
        ...prev,
        { sender: "patient", text: patientResponse, time: "Just now" },
      ]);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(26,116,144,0.12),_transparent_40%),linear-gradient(180deg,#0f172a_0%,#1e293b_100%)] text-slate-100 font-sans flex">
      
      {/* Sidebar Navigation */}
      <aside className="w-80 hidden lg:flex flex-col bg-slate-950 text-white border-r border-slate-850 p-8 justify-between relative overflow-hidden shrink-0">
        <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />

        <div className="space-y-10 relative z-10">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-1 select-none">
            <span className="font-display text-2xl tracking-tight">
              <span className="text-brand-red font-black">H</span>
              <span className="text-white font-extrabold">ealth</span>
              <span className="text-brand-teal font-black">K</span>
              <span className="text-white font-extrabold">o</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded ml-2 tracking-wider">
              CLINIC
            </span>
          </Link>

          {/* Nav List */}
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all ${
                activeTab === "overview"
                  ? "bg-brand-teal text-white shadow-md shadow-brand-teal/20"
                  : "text-slate-400 hover:bg-slate-850 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Clinical Overview</span>
            </button>

            <button
              onClick={() => setActiveTab("patients")}
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all ${
                activeTab === "patients"
                  ? "bg-brand-teal text-white shadow-md shadow-brand-teal/20"
                  : "text-slate-400 hover:bg-slate-850 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Patient Management</span>
            </button>

            <button
              onClick={() => setActiveTab("schedule")}
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all ${
                activeTab === "schedule"
                  ? "bg-brand-teal text-white shadow-md shadow-brand-teal/20"
                  : "text-slate-400 hover:bg-slate-850 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Schedule Console</span>
            </button>

            {activeCallBooking && (
              <button
                onClick={() => setActiveTab("telehealth")}
                className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all animate-pulse ${
                  activeTab === "telehealth"
                    ? "bg-brand-red text-white shadow-md shadow-brand-red/20"
                    : "bg-brand-red/20 text-brand-red hover:bg-brand-red/30"
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Clinical Workspace</span>
              </button>
            )}
          </nav>
        </div>

        {/* Doctor profile snap */}
        <div className="border-t border-slate-800 pt-6 space-y-4 relative z-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">
              Licensed Clinician
            </p>
            <p className="mt-1 font-display font-black text-white text-md">
              {doctor.name}
            </p>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">{doctor.specialty}</p>
            <p className="text-[9px] text-slate-500 font-bold mt-1">NPI: {doctor.npi}</p>
          </div>
          <form action={logoutDoctor}>
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-850 hover:bg-brand-red py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-6 lg:p-10 max-h-screen overflow-y-auto">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
          <Link href="/" className="flex items-center space-x-1 select-none">
            <span className="font-display text-xl tracking-tight">
              <span className="text-brand-red font-black">H</span>
              <span className="text-white font-extrabold">ealth</span>
              <span className="text-brand-teal font-black">K</span>
              <span className="text-white font-extrabold">o</span>
            </span>
          </Link>

          <form action={logoutDoctor}>
            <button
              type="submit"
              className="text-xs font-black uppercase tracking-wider bg-slate-800 text-white px-3.5 py-2 rounded-xl"
            >
              Log Out
            </button>
          </form>
        </header>

        {/* ── MODULE A: CLINICAL OVERVIEW PANEL ── */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-fade-in">
            {/* Header branding */}
            <div className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-teal">
                  Practitioner clinical environment
                </span>
                <h1 className="font-display text-3xl font-black tracking-tight text-white">
                  Welcome, {doctor.name}
                </h1>
                <p className="text-xs font-semibold text-slate-400">
                  Manage patient consultation queues, review scheduling availability logs, and initiate end-to-end encrypted telehealth encounters.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {doctor.isVerified && (
                  <span className="rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 px-4.5 py-1.5 text-xs font-black uppercase tracking-widest">
                    License Verified
                  </span>
                )}
              </div>
            </div>

            {/* Diagnostics Stats */}
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-850 bg-slate-950 p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-brand-teal/10 blur-2xl pointer-events-none" />
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-teal">
                  Pending Authorization
                </p>
                <p className="mt-4 font-display text-4xl font-black text-white">{pendingAppointments.length}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">Appointment requests awaiting review</p>
              </div>

              <div className="rounded-2xl border border-slate-850 bg-slate-950 p-6 shadow-md">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-teal">
                  Confirmed Visits
                </p>
                <p className="mt-4 font-display text-4xl font-black text-white">{confirmedAppointments.length}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Active consultations queued</p>
              </div>

              <div className="rounded-2xl border border-slate-850 bg-slate-950 p-6 shadow-md">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-red">
                  Practitioner Volume
                </p>
                <p className="mt-4 font-display text-4xl font-black text-white">{patientsList.length}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">Distinct patients managed in this portal</p>
              </div>
            </div>

            {/* Split layout for queues */}
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Confirmed consultations queue */}
              <div className="rounded-[2rem] border border-slate-850 bg-slate-900/90 p-6 shadow-md">
                <h2 className="font-display text-lg font-black tracking-tight text-white mb-6">
                  Confirmed Encounters Queue
                </h2>

                {confirmedAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {confirmedAppointments.map((booking) => (
                      <div
                        key={booking.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4 hover:border-brand-teal/40 transition-all"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div>
                            <h3 className="text-base font-black text-white">
                              Patient: {booking.patient.firstName} {booking.patient.lastName}
                            </h3>
                            <p className="text-xs text-slate-400 font-semibold mt-1">
                              DOB: {booking.patient.dob} | Gender: {booking.patient.gender || "Unspecified"}
                            </p>
                            <p className="text-xs text-slate-350 leading-relaxed mt-2.5">
                              <strong>Indicated Chief Complaint:</strong> {booking.reason}
                            </p>
                          </div>

                          <div className="shrink-0 text-right flex flex-col items-end gap-2">
                            <span className="rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2 text-xs font-black text-slate-300">
                              {formatDateTime(booking.scheduledAt)}
                            </span>
                            <button
                              onClick={() => startTelehealth(booking)}
                              className="bg-brand-red hover:bg-brand-teal text-white font-bold text-[9px] tracking-wider uppercase px-4 py-2.5 rounded-xl shadow-md transition-all animate-bounce"
                            >
                              Launch Telehealth
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
                    <p className="text-sm font-black uppercase tracking-wider text-slate-400">
                      No Active Encounters
                    </p>
                    <p className="text-xs mt-2 max-w-sm mx-auto leading-relaxed">
                      Confirmed video consultation slots will appear in this clinical buffer. Patients can enter waiting rooms once confirmed.
                    </p>
                  </div>
                )}
              </div>

              {/* Pending reviews block */}
              <div className="rounded-[2rem] border border-slate-850 bg-slate-900/90 p-6 shadow-md">
                <h2 className="font-display text-lg font-black tracking-tight text-white mb-6">
                  Awaiting Clinician Review ({pendingAppointments.length})
                </h2>

                {pendingAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {pendingAppointments.slice(0, 3).map((booking) => (
                      <div key={booking.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                        <div>
                          <h4 className="text-xs font-black text-white">
                            {booking.patient.firstName} {booking.patient.lastName}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            Date requested: {formatDateTime(booking.scheduledAt)}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-relaxed line-clamp-2">
                          <strong>Visit reason:</strong> {booking.reason}
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleAccept(booking.id)}
                            disabled={actionLoadingId === booking.id}
                            className="flex-grow bg-brand-teal text-white text-[9px] font-black uppercase tracking-wider py-1.5 rounded-lg text-center"
                          >
                            Approve Slot
                          </button>
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={actionLoadingId === booking.id}
                            className="bg-slate-850 text-slate-300 hover:bg-brand-red hover:text-white text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                    {pendingAppointments.length > 3 && (
                      <button
                        onClick={() => setActiveTab("schedule")}
                        className="w-full text-center text-xs font-bold text-brand-teal hover:underline pt-2"
                      >
                        View all pending requests →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No pending appointment requests.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MODULE B: PATIENT MANAGEMENT ── */}
        {activeTab === "patients" && (
          <div className="space-y-8 animate-fade-in">
            <header className="space-y-2">
              <span className="text-[10px] font-black text-brand-teal uppercase bg-brand-teal/10 border border-brand-teal/20 px-2 py-0.5 rounded tracking-widest">
                Clinical Registry
              </span>
              <h2 className="font-display text-2xl font-black text-white tracking-tight">
                Patient Management Registry
              </h2>
              <p className="text-slate-400 font-semibold text-xs leading-relaxed">
                Review distinct patients mapped to your clinical database file. Drill down to audit historical chief complaints and documented e-prescriptions.
              </p>
            </header>

            <div className="rounded-[2rem] border border-slate-850 bg-slate-900/90 p-6 shadow-md">
              {patientsList.length > 0 ? (
                <div className="space-y-4">
                  {patientsList.map((patient) => {
                    const patientBookings = doctor.bookings.filter((b) => b.patient.id === patient.id);
                    return (
                      <div
                        key={patient.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4 hover:border-slate-700 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-black text-white">
                              {patient.firstName} {patient.lastName}
                            </h3>
                            <p className="text-xs font-semibold text-slate-450 mt-1">
                              DOB: {patient.dob} | Contact: {patient.phone} | Email: {patient.email}
                            </p>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <span className="rounded-full bg-slate-900 border border-slate-850 px-3.5 py-1.5 text-[10px] font-black uppercase text-slate-350 tracking-wider">
                              {patientBookings.length} Total Encounters
                            </span>
                          </div>
                        </div>

                        {/* Collapsible/Detail of encounters for this patient */}
                        <div className="border-t border-slate-900 pt-4 space-y-2.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Encounters Timeline
                          </p>
                          {patientBookings.map((b) => (
                            <div key={b.id} className="bg-slate-900 rounded-xl p-3 text-xs flex justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-300">
                                    {formatDate(b.scheduledAt)}
                                  </span>
                                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                    b.status === "COMPLETED" ? "bg-emerald-950 text-emerald-400" : "bg-slate-800 text-slate-450"
                                  }`}>
                                    {b.status}
                                  </span>
                                </div>
                                <p className="text-slate-450 mt-1"><strong>Complaint:</strong> {b.reason}</p>
                                {b.notes && (
                                  <p className="text-slate-400 mt-1"><strong>Clinical notes:</strong> {b.notes}</p>
                                )}
                                {b.prescription && (
                                  <p className="text-brand-red font-semibold mt-1"><strong>Prescription Issued:</strong> {b.prescription}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-950 rounded-2xl text-slate-500 text-xs">
                  No active patients registered in your clinical roster.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODULE C: SCHEDULE MANAGEMENT ── */}
        {activeTab === "schedule" && (
          <div className="space-y-8 animate-fade-in">
            <header className="space-y-2">
              <span className="text-[10px] font-black text-brand-red uppercase bg-brand-red-tint/10 border border-brand-red/10 px-2 py-0.5 rounded tracking-widest">
                Clinical Ledger
              </span>
              <h2 className="font-display text-2xl font-black text-white tracking-tight">
                Clinician Schedule Management
              </h2>
              <p className="text-slate-400 font-semibold text-xs leading-relaxed">
                Approve or cancel reservation slots requested by patients, and review historically archived clinical sessions.
              </p>
            </header>

            {/* Grid layout */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: All pending slots */}
              <div className="rounded-[2rem] border border-slate-850 bg-slate-900/90 p-6 shadow-md">
                <h3 className="font-display text-base font-black text-white mb-5">
                  Pending Request Authorization Queue
                </h3>

                {pendingAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {pendingAppointments.map((booking) => (
                      <div key={booking.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <h4 className="text-sm font-black text-white">
                              Patient: {booking.patient.firstName} {booking.patient.lastName}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              DOB: {booking.patient.dob} | Contact: {booking.patient.phone}
                            </p>
                          </div>
                          <span className="rounded bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 text-center shrink-0">
                            {formatDateTime(booking.scheduledAt)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-350 leading-relaxed bg-slate-900/50 p-2.5 rounded-lg border border-slate-900">
                          <strong>Chief complaint:</strong> {booking.reason}
                        </p>

                        <div className="flex gap-2.5">
                          <button
                            onClick={() => handleAccept(booking.id)}
                            disabled={actionLoadingId === booking.id}
                            className="flex-grow bg-brand-teal text-white text-xs font-black uppercase py-2 rounded-xl text-center"
                          >
                            Accept & Schedule Room
                          </button>
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={actionLoadingId === booking.id}
                            className="bg-slate-850 hover:bg-brand-red text-slate-350 hover:text-white text-xs font-black uppercase px-4 py-2 rounded-xl"
                          >
                            Cancel Request
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    No pending appointment requests.
                  </div>
                )}
              </div>

              {/* Right Column: Historical sessions */}
              <div className="rounded-[2rem] border border-slate-850 bg-slate-900/90 p-6 shadow-md">
                <h3 className="font-display text-base font-black text-white mb-5">
                  Completed Encounters Archive
                </h3>

                {completedConsultations.length > 0 ? (
                  <div className="space-y-4">
                    {completedConsultations.map((booking) => (
                      <div key={booking.id} className="rounded-xl border border-slate-850 bg-slate-950 p-4 space-y-2 text-xs">
                        <div className="flex justify-between items-center gap-4">
                          <h4 className="font-black text-white">
                            {booking.patient.firstName} {booking.patient.lastName}
                          </h4>
                          <span className="text-slate-450 font-bold">
                            {formatDate(booking.scheduledAt)}
                          </span>
                        </div>
                        <p className="text-slate-400">
                          <strong>Clinical notes:</strong> {booking.notes}
                        </p>
                        <p className="text-brand-red font-semibold">
                          <strong>Rx:</strong> {booking.prescription}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    No completed/archived clinical encounters yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MODULE D: CLINICAL TELEHEALTH WORKSPACE (WebRTC Simulator) ── */}
        {activeTab === "telehealth" && activeCallBooking && (
          <div className="h-[80vh] flex flex-col bg-slate-950 rounded-3xl border border-slate-800 text-white shadow-2xl overflow-hidden animate-fade-in relative">
            {/* Header branding */}
            <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center z-10">
              <div className="flex items-center space-x-3">
                <span className="h-2 w-2 rounded-full bg-brand-red animate-pulse" />
                <div>
                  <h3 className="font-display font-black text-sm tracking-tight text-white">
                    Live Telehealth Consultation workspace
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Patient: {activeCallBooking.patient.firstName} {activeCallBooking.patient.lastName} | DOB: {activeCallBooking.patient.dob}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-[9px] font-black uppercase bg-slate-850 border border-slate-800 px-3 py-1 rounded text-brand-teal tracking-widest">
                  AES-256 SRTP Stream
                </span>
                <button
                  onClick={() => {
                    if (confirm("Disconnect live telehealth channel?")) {
                      setActiveCallBooking(null);
                      setActiveTab("overview");
                    }
                  }}
                  className="bg-brand-red hover:bg-brand-red/90 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-all"
                >
                  Disconnect
                </button>
              </div>
            </header>

            {/* Split layout: Video (6 cols), Notes editor (3 cols), Chat (3 cols) */}
            <div className="flex-grow grid lg:grid-cols-12 overflow-hidden relative">
              {/* Left Side: Video streams (6 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-center items-center bg-slate-950 p-4 relative overflow-hidden">
                {callStatus === "waiting" ? (
                  /* Waiting screen */
                  <div className="text-center space-y-4 max-w-xs">
                    <div className="h-12 w-12 rounded-full border-2 border-dashed border-brand-teal flex items-center justify-center text-brand-teal mx-auto animate-spin">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-display font-black text-sm text-white">Patient connection pending</h4>
                      <p className="text-[10px] text-slate-450 leading-relaxed font-semibold mt-1">
                        Securing WebRTC handshake. Waiting for patient to join the virtual telehealth waiting room...
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Active video grid */
                  <div className="w-full h-full flex flex-col gap-3 p-1 relative">
                    
                    {/* Patient Video Stream */}
                    <div className="flex-grow bg-slate-900 rounded-xl border border-slate-850 overflow-hidden relative min-h-[160px]">
                      <div className="absolute inset-0 flex flex-col justify-center items-center">
                        <div className="absolute inset-0 bg-cover bg-center opacity-65" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80')" }} />
                        <div className="absolute inset-0 bg-slate-950/20" />
                        <span className="relative z-10 text-[9px] font-black uppercase bg-slate-950/80 px-2 py-0.5 rounded text-white tracking-widest">
                          Patient Incoming Feed
                        </span>
                      </div>
                      <div className="absolute bottom-3 left-3 bg-slate-950/80 px-2 py-1 rounded text-[10px] font-bold z-10 border border-slate-800 text-brand-teal">
                        {activeCallBooking.patient.firstName} {activeCallBooking.patient.lastName} (Patient)
                      </div>
                    </div>

                    {/* Doctor Self Stream */}
                    <div className="h-1/3 bg-slate-900 rounded-xl border border-slate-850 overflow-hidden relative">
                      {isCameraOn ? (
                        <div className="absolute inset-0 flex flex-col justify-center items-center">
                          <div className="absolute inset-0 bg-cover bg-center opacity-65" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80')" }} />
                          <div className="absolute inset-0 bg-slate-950/20" />
                          <span className="relative z-10 text-[8px] font-black uppercase bg-slate-950/80 px-2 py-0.5 rounded text-white tracking-widest">
                            Self Stream
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-950 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                          Camera Disabled
                        </div>
                      )}
                      
                      <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[9px] font-bold z-10 border border-slate-800 text-slate-350">
                        {doctor.name} (Self)
                      </div>
                    </div>

                  </div>
                )}

                {/* Video action triggers */}
                <div className="mt-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex items-center space-x-4 z-20 shadow-md">
                  <button
                    onClick={() => setIsCameraOn(!isCameraOn)}
                    className={`p-2 rounded-lg transition-all ${
                      isCameraOn ? "bg-slate-800 text-brand-teal hover:bg-slate-750" : "bg-brand-red text-white"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setIsMicOn(!isMicOn)}
                    className={`p-2 rounded-lg transition-all ${
                      isMicOn ? "bg-slate-800 text-brand-teal hover:bg-slate-750" : "bg-brand-red text-white"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Middle Column: Clinical Notes & Prescription Pad (4 cols) */}
              <div className="lg:col-span-4 bg-slate-900 border-l border-r border-slate-800 p-4 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-4">
                  <div className="pb-2 border-b border-slate-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-350">
                      Practitioner clinical documentation
                    </h4>
                  </div>

                  <form onSubmit={handleComplete} className="space-y-4">
                    {submitError && (
                      <div className="p-2.5 bg-brand-red/10 border border-brand-red/15 text-brand-red font-bold text-[10px] rounded-lg text-center">
                        {submitError}
                      </div>
                    )}
                    {submitSuccess && (
                      <div className="p-2.5 bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 font-bold text-[10px] rounded-lg text-center">
                        {submitSuccess}
                      </div>
                    )}

                    {/* Diagnosis / Impression */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-450 uppercase mb-1 tracking-wider">
                        Clinical Diagnosis / Impression
                      </label>
                      <input
                        type="text"
                        value={diagnosisText}
                        onChange={(e) => setDiagnosisText(e.target.value)}
                        placeholder="e.g. Acute Bronchitis"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-brand-teal"
                      />
                    </div>

                    {/* Clinical Encounter Notes */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-450 uppercase mb-1 tracking-wider">
                        Clinical Notes (HIPAA Records)
                      </label>
                      <textarea
                        required
                        rows={6}
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        placeholder="Document subjective symptoms, physical clinical findings, and directive care instructions..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-brand-teal leading-relaxed"
                      />
                    </div>

                    {/* E-Prescription instructions */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-450 uppercase mb-1 tracking-wider">
                        E-Prescription (Rx Formulation)
                      </label>
                      <input
                        type="text"
                        required
                        value={prescriptionText}
                        onChange={(e) => setPrescriptionText(e.target.value)}
                        placeholder="e.g. Albuterol 90mcg Inhaler - 1-2 puffs q4-6h prn"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-brand-red placeholder-slate-650 focus:outline-none focus:border-brand-teal"
                      />
                    </div>

                    {/* Submit pad */}
                    <button
                      type="submit"
                      disabled={submitLoading || callStatus === "waiting"}
                      className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-[10px] tracking-wider uppercase py-3 rounded-xl transition-all shadow-md disabled:bg-slate-800 flex items-center justify-center space-x-2"
                    >
                      {submitLoading ? (
                        <span>Logging Clinical Data...</span>
                      ) : (
                        <span>Complete & Issue Prescription</span>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Secure Chat Sidebar (3 cols) */}
              <div className="lg:col-span-3 bg-slate-900 border-l border-slate-800 flex flex-col justify-between overflow-hidden">
                <div className="p-3 bg-slate-950 border-b border-slate-800">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-350">
                    Encrypted Session Chat
                  </h4>
                </div>

                {/* Messages list */}
                <div className="flex-grow p-3 overflow-y-auto space-y-3 max-h-[30vh] lg:max-h-[50vh]">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col space-y-0.5 ${
                        msg.sender === "doctor" ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">
                        {msg.sender === "doctor" ? "You" : "Patient"}
                      </span>
                      <div className={`p-2.5 rounded-xl text-[11px] max-w-[90%] leading-relaxed ${
                        msg.sender === "doctor"
                          ? "bg-brand-teal text-white rounded-tr-none"
                          : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-750"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form submit message */}
                <form onSubmit={sendMessage} className="p-3 bg-slate-950 border-t border-slate-850 flex gap-1.5">
                  <input
                    type="text"
                    required
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="Type..."
                    className="flex-grow bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-550 focus:outline-none focus:border-brand-teal"
                  />
                  <button
                    type="submit"
                    className="bg-brand-teal text-white font-bold text-[10px] px-3 rounded-lg transition-all"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
