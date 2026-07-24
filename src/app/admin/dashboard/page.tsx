import Link from "next/link";

import { getPendingDoctorAudits } from "@/app/actions/audit";
import { logoutAdmin } from "@/app/actions/auth";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { mockDb } from "@/lib/mockDb";

import AdminAuditReviewClient from "./AdminAuditReviewClient";

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const metrics = mockDb.getAdminMetrics();
  const auditsResult = await getPendingDoctorAudits();
  const audits = auditsResult.success ? auditsResult.audits : [];

  const totalUsers = metrics.totalPatients + metrics.totalDoctors;
  const activeUsers = metrics.activePatients + metrics.activeDoctors;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-teal">Admin Console</p>
              <h1 className="font-display text-3xl font-black tracking-tight">Welcome, HealthKo Admin</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                You are signed in as <span className="font-semibold text-white">{session.email}</span>. Use the partnership
                review queue to approve or reject doctors who want to join HealthKo.
              </p>
            </div>

            <form action={logoutAdmin}>
              <button
                type="submit"
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Sign out
              </button>
            </form>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Total users</p>
              <p className="mt-2 text-3xl font-black">{totalUsers}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Active users</p>
              <p className="mt-2 text-3xl font-black">{activeUsers}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Pending audits</p>
              <p className="mt-2 text-3xl font-black">{audits.length}</p>
            </div>
          </div>
        </div>

        <AdminAuditReviewClient initialAudits={audits} />

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Accounts</p>
            <h2 className="mt-2 text-xl font-bold">Manage portal users</h2>
            <p className="mt-2 text-sm text-slate-300">Patient, doctor, and admin access controls can live here next.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Operations</p>
            <h2 className="mt-2 text-xl font-bold">Review health checks</h2>
            <p className="mt-2 text-sm text-slate-300">Add monitoring, reports, and workflow actions as you expand this area.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Shortcuts</p>
            <h2 className="mt-2 text-xl font-bold">Jump back to portals</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
              <Link href="/signin" className="text-brand-teal hover:underline">
                Patient login
              </Link>
              <Link href="/doctor/signin" className="text-brand-teal hover:underline">
                Doctor login
              </Link>
              <Link href="/admin/doctors" className="text-brand-teal hover:underline">
                Doctor review queue
              </Link>
              <Link href="/admin/signin" className="text-brand-teal hover:underline">
                Admin login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
