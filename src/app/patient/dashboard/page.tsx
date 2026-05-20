import Link from "next/link";

import { logoutPatient } from "@/app/actions/auth";
import { getPatientDashboardData } from "@/lib/dal/patient";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function PatientDashboardPage() {
  const { patient } = await getPatientDashboardData();

  const now = new Date();
  const upcomingConsultations = patient.bookings.filter((booking) => booking.scheduledAt >= now);
  const recentConsultations = [...patient.bookings]
    .filter((booking) => booking.scheduledAt < now)
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(26,116,144,0.14),_transparent_38%),linear-gradient(180deg,#f8fbfc_0%,#eef5f7_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-brand-teal">
              Patient Dashboard
            </p>
            <h1 className="font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Welcome back, {patient.firstName}
            </h1>
            <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              Review upcoming care, track your recent consultations, and keep your HealthKo profile ready for your next appointment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.25em] ${
              patient.emailVerified
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-amber-50 text-amber-700 border border-amber-100"
            }`}>
              {patient.emailVerified ? "Email Verified" : "Verification Pending"}
            </span>
            <form action={logoutPatient}>
              <button
                type="submit"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-slate-700 transition-colors hover:border-brand-teal hover:text-brand-teal"
              >
                Log Out
              </button>
            </form>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <article className="rounded-[1.75rem] border border-white/70 bg-slate-900 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-teal">
                  Care Snapshot
                </p>
                <p className="mt-4 font-display text-4xl font-black">
                  {upcomingConsultations.length}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-300">
                  upcoming consultations currently scheduled
                </p>
              </article>

              <article className="rounded-[1.75rem] border border-brand-teal/15 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-teal">
                  Profile Since
                </p>
                <p className="mt-4 font-display text-3xl font-black text-slate-900">
                  {formatDate(patient.createdAt)}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  secure account activation date
                </p>
              </article>

              <article className="rounded-[1.75rem] border border-brand-red/10 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-red">
                  History
                </p>
                <p className="mt-4 font-display text-3xl font-black text-slate-900">
                  {patient.bookings.length}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  total consultations on your record
                </p>
              </article>
            </div>

            <article className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-teal">
                    Upcoming Consultations
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-slate-900">
                    Your next visits
                  </h2>
                </div>
                <Link
                  href="/#dashboard-preview"
                  className="rounded-full border border-brand-teal/20 bg-brand-teal-tint px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
                >
                  Explore Portal
                </Link>
              </div>

              {upcomingConsultations.length > 0 ? (
                <div className="space-y-4">
                  {upcomingConsultations.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-slate-900">
                              {booking.doctor.name}
                            </h3>
                            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">
                              {booking.status}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-500">
                            {booking.doctor.specialty}
                          </p>
                          <p className="text-sm text-slate-600">
                            {booking.reason || "General follow-up consultation"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">
                          {formatDateTime(booking.scheduledAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-brand-teal/25 bg-brand-teal-tint p-8 text-center">
                  <p className="text-sm font-black uppercase tracking-[0.3em] text-brand-teal">
                    No visits booked yet
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-black text-slate-900">
                    Your schedule is open
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
                    When you book your first consult, it will appear here with your doctor, visit reason, and session time so you can stay ready.
                  </p>
                </div>
              )}
            </article>

            <article className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-5">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-red">
                  Recent Records
                </p>
                <h2 className="mt-2 font-display text-2xl font-black tracking-tight text-slate-900">
                  Consultation history
                </h2>
              </div>

              {recentConsultations.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {recentConsultations.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm"
                    >
                      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                        {formatDate(booking.scheduledAt)}
                      </p>
                      <h3 className="mt-3 text-lg font-black text-slate-900">
                        {booking.doctor.name}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {booking.doctor.specialty}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        {booking.reason || "Consultation summary available in your record."}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
                          {booking.status}
                        </span>
                        {booking.prescription && (
                          <span className="rounded-full bg-brand-red-tint px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-brand-red">
                            Prescription Added
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <h3 className="font-display text-2xl font-black text-slate-900">
                    Your record timeline starts here
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
                    Once you complete your first consultation, visit summaries and prescription history will begin building in this section.
                  </p>
                </div>
              )}
            </article>
          </section>

          <aside className="space-y-6">
            <article className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-teal">
                Profile Summary
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="font-display text-2xl font-black text-slate-900">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Secure patient account
                  </p>
                </div>
                <div className="grid gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Email
                    </p>
                    <p className="mt-1 font-bold text-slate-700">{patient.email}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Phone
                    </p>
                    <p className="mt-1 font-bold text-slate-700">
                      {patient.countryCode} {patient.phone}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Date of Birth
                    </p>
                    <p className="mt-1 font-bold text-slate-700">{patient.dob}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Gender
                    </p>
                    <p className="mt-1 font-bold text-slate-700">{patient.gender || "Not specified"}</p>
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-[2rem] border border-white/70 bg-slate-900 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-teal">
                Quick Actions
              </p>
              <div className="mt-5 space-y-3">
                <Link
                  href="/"
                  className="block rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-4 transition-colors hover:border-brand-teal/40 hover:bg-white/10"
                >
                  <p className="text-sm font-black">Return to homepage</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Browse the main patient experience and featured doctors.
                  </p>
                </Link>
                <Link
                  href="/#dashboard-preview"
                  className="block rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-4 transition-colors hover:border-brand-teal/40 hover:bg-white/10"
                >
                  <p className="text-sm font-black">Explore the interactive portal demo</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Preview records, messages, and consultation experiences.
                  </p>
                </Link>
                <Link
                  href="/forgot-password"
                  className="block rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-4 transition-colors hover:border-brand-teal/40 hover:bg-white/10"
                >
                  <p className="text-sm font-black">Update your account security</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">
                    Reset your password if you need to rotate your credentials.
                  </p>
                </Link>
              </div>
            </article>
          </aside>
        </div>
      </div>
    </div>
  );
}
