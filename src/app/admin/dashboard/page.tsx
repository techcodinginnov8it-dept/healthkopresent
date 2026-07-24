import Link from "next/link";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { mockDb } from "@/lib/mockDb";
import { requireAdminSession } from "@/lib/auth/admin-session";

function getPeriodStarts() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return { dayStart, weekStart, monthStart };
}

async function getAdminMetrics() {
  if (isPrismaConfigured()) {
    try {
      const { dayStart, weekStart, monthStart } = getPeriodStarts();
      const [
        totalPatients,
        totalDoctors,
        activePatients,
        activeDoctors,
        onlineDoctors,
        offlineDoctors,
        totalConsultations,
        dailyNewPatients,
        weeklyNewPatients,
        monthlyNewPatients,
        dailyNewDoctors,
        weeklyNewDoctors,
        monthlyNewDoctors,
        dailyConsultations,
        weeklyConsultations,
        monthlyConsultations,
      ] = await Promise.all([
        prisma.patient.count(),
        prisma.doctor.count(),
        prisma.patient.count({ where: { isActive: true } }),
        prisma.doctor.count({ where: { isActive: true } }),
        prisma.doctor.count({ where: { isActive: true, status: "ONLINE" } }),
        prisma.doctor.count({ where: { isActive: true, status: { not: "ONLINE" } } }),
        prisma.consultation.count(),
        prisma.patient.count({ where: { createdAt: { gte: dayStart } } }),
        prisma.patient.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.patient.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.doctor.count({ where: { createdAt: { gte: dayStart } } }),
        prisma.doctor.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.doctor.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.consultation.count({ where: { createdAt: { gte: dayStart } } }),
        prisma.consultation.count({ where: { createdAt: { gte: weekStart } } }),
        prisma.consultation.count({ where: { createdAt: { gte: monthStart } } }),
      ]);

      return {
        totalPatients,
        totalDoctors,
        activePatients,
        activeDoctors,
        onlineDoctors,
        offlineDoctors,
        totalConsultations,
        dailyNewPatients,
        weeklyNewPatients,
        monthlyNewPatients,
        dailyNewDoctors,
        weeklyNewDoctors,
        monthlyNewDoctors,
        dailyConsultations,
        weeklyConsultations,
        monthlyConsultations,
      };
    } catch (error) {
      console.warn("Admin metrics Prisma query failed, falling back to mock metrics:", error);
      return mockDb.getAdminMetrics();
    }
  }

  return mockDb.getAdminMetrics();
}

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const metrics = await getAdminMetrics();
  const totalUsers = metrics.totalPatients + metrics.totalDoctors;
  const activeUsers = metrics.activePatients + metrics.activeDoctors;

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-teal">ADMIN DASHBOARD</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Operations overview</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              This workspace is now equipped with a simple admin portal for local testing and monitoring.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
            Signed in as <span className="font-semibold text-white">{session.email}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <p className="text-sm text-slate-400">Total users</p>
            <p className="mt-2 text-3xl font-black">{totalUsers}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <p className="text-sm text-slate-400">Active users</p>
            <p className="mt-2 text-3xl font-black">{activeUsers}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <p className="text-sm text-slate-400">Online doctors</p>
            <p className="mt-2 text-3xl font-black">{metrics.onlineDoctors}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <p className="text-sm text-slate-400">Offline doctors</p>
            <p className="mt-2 text-3xl font-black">{metrics.offlineDoctors}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
            <p className="text-sm text-slate-400">Total consultations</p>
            <p className="mt-2 text-3xl font-black">{metrics.totalConsultations}</p>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-10">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">New registrations</p>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Patients today</p>
                  <p className="mt-2 text-3xl font-black">{metrics.dailyNewPatients}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Patients this week</p>
                  <p className="mt-2 text-3xl font-black">{metrics.weeklyNewPatients}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Patients this month</p>
                  <p className="mt-2 text-3xl font-black">{metrics.monthlyNewPatients}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Doctor onboarding</p>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Doctors today</p>
                  <p className="mt-2 text-3xl font-black">{metrics.dailyNewDoctors}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Doctors this week</p>
                  <p className="mt-2 text-3xl font-black">{metrics.weeklyNewDoctors}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Doctors this month</p>
                  <p className="mt-2 text-3xl font-black">{metrics.monthlyNewDoctors}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Consultation volume</p>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Today</p>
                  <p className="mt-2 text-3xl font-black">{metrics.dailyConsultations}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">This week</p>
                  <p className="mt-2 text-3xl font-black">{metrics.weeklyConsultations}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">This month</p>
                  <p className="mt-2 text-3xl font-black">{metrics.monthlyConsultations}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Quick Actions</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link
              href="/admin/doctors"
              className="rounded-2xl border border-brand-teal/30 bg-brand-teal/5 p-6 hover:bg-brand-teal/10 transition"
            >
              <p className="text-sm font-semibold text-brand-teal">Doctor Screening</p>
              <p className="mt-2 text-xs text-slate-400">Review and approve pending doctor applications</p>
            </Link>
            <Link
              href="/admin/signin"
              className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6 hover:bg-slate-900 transition"
            >
              <p className="text-sm font-semibold text-slate-300">Settings</p>
              <p className="mt-2 text-xs text-slate-500">Manage admin account and preferences</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
