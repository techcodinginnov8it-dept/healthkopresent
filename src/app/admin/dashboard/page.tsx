import { requireAdminSession } from "@/lib/auth/admin-session";
import { getAdminDashboardData } from "@/app/actions/admin";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const data = await getAdminDashboardData();

  const defaultStats = {
    totalPatients: 0,
    activePatients: 0,
    totalDoctors: 0,
    activeDoctors: 0,
    verifiedDoctors: 0,
    pendingAudits: 0,
    totalConsultations: 0,
    completedConsultations: 0,
    activeVideoConsultations: 0,
  };

  return (
    <AdminDashboardClient
      adminEmail={session.email}
      initialStats={data.stats || defaultStats}
      initialAudits={data.audits || []}
      initialDoctors={data.doctors || []}
      initialPatients={data.patients || []}
      initialConsultations={data.consultations || []}
    />
  );
}
