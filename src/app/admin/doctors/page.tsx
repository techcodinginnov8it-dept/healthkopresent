import Link from "next/link";

import { getPendingDoctorAudits } from "@/app/actions/audit";
import { logoutAdmin } from "@/app/actions/auth";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { mockDb } from "@/lib/mockDb";

import AdminAuditReviewClient from "../dashboard/AdminAuditReviewClient";

export default async function AdminDoctorsPage() {
  const session = await requireAdminSession();
  const metrics = mockDb.getAdminMetrics();
  const auditsResult = await getPendingDoctorAudits();
  const audits = auditsResult.success ? auditsResult.audits : [];

  const totalDoctors = metrics.totalDoctors;
  const activeDoctors = metrics.activeDoctors;
  const pendingReviews = audits.length;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white sm:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-teal">Partnership Review</p>
              <h1 className="font-display text-3xl font-black tracking-tight">Doctors who want to partner with HealthKo</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                Review new doctor submissions, verify credentials, and approve the practitioners you want to onboard into
                the HealthKo network. Signed in as <span className="font-semibold text-white">{session.email}</span>.
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
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Total doctors</p>
              <p className="mt-2 text-3xl font-black">{totalDoctors}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Active doctors</p>
              <p className="mt-2 text-3xl font-black">{activeDoctors}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Pending partner reviews</p>
              <p className="mt-2 text-3xl font-black">{pendingReviews}</p>
            </div>
          </div>
        </div>

        <AdminAuditReviewClient initialAudits={audits} />

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Review flow</p>
            <h2 className="mt-2 text-xl font-bold">Approve qualified doctors</h2>
            <p className="mt-2 text-sm text-slate-300">
              Confirm licensing, training, and submitted documents before opening access to the clinic platform.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Status</p>
            <h2 className="mt-2 text-xl font-bold">Credential queue</h2>
            <p className="mt-2 text-sm text-slate-300">
              New doctor partnership requests land here automatically as they submit their audit package.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Shortcuts</p>
            <h2 className="mt-2 text-xl font-bold">Jump back to admin</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
              <Link href="/admin/dashboard" className="text-brand-teal hover:underline">
                Admin dashboard
              </Link>
              <Link href="/admin/signin" className="text-brand-teal hover:underline">
                Admin login
              </Link>
              <Link href="/doctor/audit" className="text-brand-teal hover:underline">
                Doctor audit form
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
