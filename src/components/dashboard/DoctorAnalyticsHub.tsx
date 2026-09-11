"use client";

import { useMemo } from "react";
import type { DashboardDoctor, DashboardPatient, DoctorAppointment } from "@/lib/dashboard/types";

type DoctorAnalyticsHubProps = {
  doctor: DashboardDoctor & {
    rating: number;
    reviewCount: number;
    consultFee?: number | null;
  };
  appointments: DoctorAppointment[];
  completedConsultations: DoctorAppointment[];
  confirmedAppointments: DoctorAppointment[];
  pendingAppointments: DoctorAppointment[];
  cancelledAppointments: DoctorAppointment[];
  patients: DashboardPatient[];
  prescriptions: DoctorAppointment[];
  tone?: "light" | "dark";
};

export function DoctorAnalyticsHub({
  doctor,
  appointments,
  completedConsultations,
  confirmedAppointments,
  pendingAppointments,
  cancelledAppointments,
  patients,
  prescriptions,
  tone = "light",
}: DoctorAnalyticsHubProps) {
  const isDark = tone === "dark";

  const consultFee = doctor.consultFee || 150;
  const estimatedRevenue = completedConsultations.length * consultFee;
  const totalEncounters = appointments.length;
  const completionRate = totalEncounters > 0 ? Math.round((completedConsultations.length / totalEncounters) * 100) : 100;
  const cancellationRate = totalEncounters > 0 ? Math.round((cancelledAppointments.length / totalEncounters) * 100) : 0;

  // 7-day encounter volume calculation
  const weeklyData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const result: Array<{ day: string; dateStr: string; count: number; isToday: boolean }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayName = days[d.getDay()];
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${dt}`;

      const count = appointments.filter((appt) => {
        const apptDate = new Date(appt.scheduledAt);
        const ay = apptDate.getFullYear();
        const am = String(apptDate.getMonth() + 1).padStart(2, "0");
        const ad = String(apptDate.getDate()).padStart(2, "0");
        return `${ay}-${am}-${ad}` === dateStr;
      }).length;

      result.push({
        day: dayName,
        dateStr,
        count,
        isToday: i === 0,
      });
    }

    return result;
  }, [appointments]);

  const maxWeeklyCount = useMemo(() => {
    const max = Math.max(...weeklyData.map((d) => d.count));
    return max > 0 ? max : 1;
  }, [weeklyData]);

  // Gender demographics
  const genderBreakdown = useMemo(() => {
    let male = 0;
    let female = 0;
    let other = 0;

    patients.forEach((p) => {
      const g = (p.gender || "").toLowerCase();
      if (g.startsWith("m")) male++;
      else if (g.startsWith("f")) female++;
      else other++;
    });

    const total = patients.length || 1;
    return {
      male: Math.round((male / total) * 100),
      female: Math.round((female / total) * 100),
      other: Math.round((other / total) * 100),
      maleCount: male,
      femaleCount: female,
      otherCount: other,
    };
  }, [patients]);

  // Average Patient Age
  const avgPatientAge = useMemo(() => {
    const ages = patients
      .map((p) => {
        if (!p.dob) return null;
        const diff = Date.now() - new Date(p.dob).getTime();
        return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
      })
      .filter((age): age is number => age !== null && age > 0 && age < 120);

    if (!ages.length) return "Adult";
    const sum = ages.reduce((acc, v) => acc + v, 0);
    return `${Math.round(sum / ages.length)} yrs`;
  }, [patients]);

  // Top visit reasons categorized
  const topReasons = useMemo(() => {
    const reasonCounts: Record<string, number> = {};
    appointments.forEach((appt) => {
      const r = (appt.reason || "General Consultation").trim();
      const cat = r.length > 30 ? `${r.slice(0, 27)}...` : r;
      reasonCounts[cat] = (reasonCounts[cat] || 0) + 1;
    });

    const total = appointments.length || 1;
    return Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({
        label,
        count,
        percent: Math.round((count / total) * 100),
      }));
  }, [appointments]);

  const handlePrintSummary = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <section className="space-y-6">
      {/* ── Top Header Banner ────────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl border p-6 transition-colors ${
          isDark
            ? "border-slate-850 bg-slate-900 text-white"
            : "border-slate-200 bg-white text-slate-900 shadow-xs"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-brand-teal animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">
                Practice Telemetry & Analytics
              </p>
            </div>
            <h2 className={`mt-1 text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
              Practice Analytics & Performance
            </h2>
            <p className={`mt-0.5 text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Real-time KPIs, financial revenue estimates, encounter volume trends, and patient demographics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrintSummary}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black transition ${
                isDark
                  ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>🖨️</span>
              Print Summary Report
            </button>
          </div>
        </div>

        {/* ── 4 Key KPI Cards ────────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Estimated Gross Revenue */}
          <div
            className={`rounded-2xl border p-4.5 transition-all ${
              isDark
                ? "border-emerald-800/40 bg-emerald-950/20"
                : "border-emerald-200 bg-emerald-50/50 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                Estimated Revenue
              </p>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-black">
                $
              </span>
            </div>
            <p className={`mt-2 text-2xl font-black ${isDark ? "text-emerald-200" : "text-emerald-950"}`}>
              ${estimatedRevenue.toLocaleString()}
            </p>
            <p className={`mt-1 text-[10px] font-semibold ${isDark ? "text-emerald-400/80" : "text-emerald-700"}`}>
              ${consultFee} base fee × {completedConsultations.length} visits
            </p>
          </div>

          {/* Card 2: Total Encounters */}
          <div
            className={`rounded-2xl border p-4.5 transition-all ${
              isDark
                ? "border-brand-teal/30 bg-brand-teal/10"
                : "border-brand-teal/20 bg-brand-teal/5 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">
                Total Encounters
              </p>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-teal/20 text-brand-teal text-xs font-black">
                📅
              </span>
            </div>
            <p className={`mt-2 text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
              {totalEncounters}
            </p>
            <p className={`mt-1 text-[10px] font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {completedConsultations.length} completed · {confirmedAppointments.length} upcoming
            </p>
          </div>

          {/* Card 3: Completion & Compliance Rate */}
          <div
            className={`rounded-2xl border p-4.5 transition-all ${
              isDark
                ? "border-blue-800/40 bg-blue-950/20"
                : "border-blue-200 bg-blue-50/50 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-blue-400" : "text-blue-700"}`}>
                Completion Rate
              </p>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/20 text-blue-400 text-xs font-black">
                ✓
              </span>
            </div>
            <p className={`mt-2 text-2xl font-black ${isDark ? "text-blue-200" : "text-blue-950"}`}>
              {completionRate}%
            </p>
            <p className={`mt-1 text-[10px] font-semibold ${isDark ? "text-blue-400/80" : "text-blue-700"}`}>
              {cancellationRate}% cancellation rate recorded
            </p>
          </div>

          {/* Card 4: Clinical Rating & Trust */}
          <div
            className={`rounded-2xl border p-4.5 transition-all ${
              isDark
                ? "border-amber-800/40 bg-amber-950/20"
                : "border-amber-200 bg-amber-50/50 shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                Patient Trust Rating
              </p>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/20 text-amber-400 text-xs font-black">
                ★
              </span>
            </div>
            <p className={`mt-2 text-2xl font-black ${isDark ? "text-amber-200" : "text-amber-950"}`}>
              {doctor.rating.toFixed(1)} <span className="text-xs font-semibold text-amber-500">/ 5.0</span>
            </p>
            <p className={`mt-1 text-[10px] font-semibold ${isDark ? "text-amber-400/80" : "text-amber-700"}`}>
              Based on {doctor.reviewCount} verified reviews
            </p>
          </div>
        </div>
      </div>

      {/* ── Middle Visual Grid: 7-Day Activity Chart & Status Meter ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 7-Day Encounter Activity Chart (7 cols) */}
        <div
          className={`lg:col-span-7 rounded-2xl border p-6 transition-colors ${
            isDark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between border-b pb-4 mb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Consultation Volume</p>
              <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                7-Day Activity Trends
              </h3>
            </div>
            <span className={`rounded-xl border px-3 py-1 text-xs font-black ${
              isDark ? "border-slate-700 bg-slate-800 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"
            }`}>
              Last 7 Days
            </span>
          </div>

          {/* Bar Chart Canvas */}
          <div className="pt-4 pb-2">
            <div className="flex items-end justify-between gap-2 h-44 px-2">
              {weeklyData.map((d) => {
                const heightPct = Math.max(Math.round((d.count / maxWeeklyCount) * 100), 12);
                return (
                  <div key={d.dateStr} className="flex flex-col items-center flex-1 h-full justify-end group">
                    {/* Tooltip / Count Label on Top */}
                    <span className={`mb-1.5 text-[10px] font-black transition-opacity ${
                      d.count > 0
                        ? isDark
                          ? "text-brand-teal opacity-100"
                          : "text-brand-teal opacity-100"
                        : "opacity-0 group-hover:opacity-100 text-slate-400"
                    }`}>
                      {d.count}
                    </span>

                    {/* Bar Pill */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[36px] rounded-t-xl transition-all duration-300 ${
                        d.isToday
                          ? "bg-brand-teal shadow-md shadow-brand-teal/30"
                          : d.count > 0
                          ? isDark
                            ? "bg-slate-700 hover:bg-brand-teal/80"
                            : "bg-slate-300 hover:bg-brand-teal/80"
                          : isDark
                          ? "bg-slate-800/60"
                          : "bg-slate-100"
                      }`}
                    />

                    {/* Day Name */}
                    <span className={`mt-2 text-[10px] font-black uppercase tracking-wider ${
                      d.isToday
                        ? "text-brand-teal font-black"
                        : isDark
                        ? "text-slate-400"
                        : "text-slate-500"
                    }`}>
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Encounter Status Breakdown Meter (5 cols) */}
        <div
          className={`lg:col-span-5 rounded-2xl border p-6 transition-colors ${
            isDark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between border-b pb-4 mb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Clinical Distribution</p>
              <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Encounter Statuses
              </h3>
            </div>
            <span className="text-xs font-black text-brand-teal">
              {totalEncounters} Total
            </span>
          </div>

          {/* Multi-segmented Progress Bar */}
          <div className="h-4 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800 my-4 shadow-inner">
            {completedConsultations.length > 0 && (
              <div
                style={{ width: `${(completedConsultations.length / (totalEncounters || 1)) * 100}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Completed: ${completedConsultations.length}`}
              />
            )}
            {confirmedAppointments.length > 0 && (
              <div
                style={{ width: `${(confirmedAppointments.length / (totalEncounters || 1)) * 100}%` }}
                className="bg-brand-teal transition-all duration-500"
                title={`Confirmed: ${confirmedAppointments.length}`}
              />
            )}
            {pendingAppointments.length > 0 && (
              <div
                style={{ width: `${(pendingAppointments.length / (totalEncounters || 1)) * 100}%` }}
                className="bg-amber-400 transition-all duration-500"
                title={`Pending: ${pendingAppointments.length}`}
              />
            )}
            {cancelledAppointments.length > 0 && (
              <div
                style={{ width: `${(cancelledAppointments.length / (totalEncounters || 1)) * 100}%` }}
                className="bg-red-400 transition-all duration-500"
                title={`Cancelled: ${cancelledAppointments.length}`}
              />
            )}
          </div>

          {/* Legend Table */}
          <div className="space-y-2.5 mt-5">
            {[
              { label: "Completed Visits", count: completedConsultations.length, color: "bg-emerald-500", text: "text-emerald-500" },
              { label: "Confirmed / Scheduled", count: confirmedAppointments.length, color: "bg-brand-teal", text: "text-brand-teal" },
              { label: "Pending Acceptance", count: pendingAppointments.length, color: "bg-amber-400", text: "text-amber-500" },
              { label: "Cancelled Visits", count: cancelledAppointments.length, color: "bg-red-400", text: "text-red-500" },
            ].map((item) => {
              const pct = totalEncounters > 0 ? Math.round((item.count / totalEncounters) * 100) : 0;
              return (
                <div key={item.label} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span className={`font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-black ${isDark ? "text-white" : "text-slate-900"}`}>{item.count}</span>
                    <span className={`text-[10px] font-bold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Demographics & Common Consultation Reasons ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Patient Demographics & Practice Reach (6 cols) */}
        <div
          className={`lg:col-span-6 rounded-2xl border p-6 transition-colors ${
            isDark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between border-b pb-4 mb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Patient Cohort</p>
              <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Demographics & Patient Reach
              </h3>
            </div>
            <span className="text-xs font-black text-brand-teal">
              {patients.length} Unique Patients
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-5">
            <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Average Patient Age</p>
              <p className={`mt-1 text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}>{avgPatientAge}</p>
            </div>
            <div className={`rounded-xl border p-3.5 ${isDark ? "border-slate-800 bg-slate-950" : "border-slate-200 bg-slate-50"}`}>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">e-Prescriptions Dispensed</p>
              <p className={`mt-1 text-lg font-black text-emerald-500`}>{prescriptions.length} Issued</p>
            </div>
          </div>

          {/* Gender Ratio Bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
              <span className={isDark ? "text-slate-300" : "text-slate-700"}>Gender Distribution</span>
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                {genderBreakdown.female}% Female · {genderBreakdown.male}% Male
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
              <div style={{ width: `${genderBreakdown.female}%` }} className="bg-pink-500" title="Female" />
              <div style={{ width: `${genderBreakdown.male}%` }} className="bg-blue-500" title="Male" />
              <div style={{ width: `${genderBreakdown.other}%` }} className="bg-purple-400" title="Other" />
            </div>
          </div>
        </div>

        {/* Right: Frequent Consultation Case Categories (6 cols) */}
        <div
          className={`lg:col-span-6 rounded-2xl border p-6 transition-colors ${
            isDark ? "border-slate-850 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between border-b pb-4 mb-5" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Clinical Specialties</p>
              <h3 className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}>
                Top Consultation Reasons
              </h3>
            </div>
            <span className="text-xs font-black text-brand-teal">
              Encounter Prevalences
            </span>
          </div>

          {topReasons.length > 0 ? (
            <div className="space-y-3">
              {topReasons.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-semibold truncate max-w-[70%] ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                      {item.label}
                    </span>
                    <span className="font-black text-brand-teal shrink-0">
                      {item.count} visit{item.count !== 1 ? "s" : ""} ({item.percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${item.percent}%` }}
                      className="h-full rounded-full bg-brand-teal transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-medium text-slate-400">
              No consultation reasons recorded yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
