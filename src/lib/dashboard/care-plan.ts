import { formatDateTime } from "@/lib/dashboard/format";
import type { AppointmentStatus, CarePlanSnapshot, DashboardRole } from "@/lib/dashboard/types";

type CarePlanAppointment = {
  scheduledAt?: Date | string;
  status?: AppointmentStatus | string;
  prescription?: string | null;
  notes?: string | null;
  reason?: string | null;
  doctor?: {
    name?: string;
  };
};

type CarePlanSource = {
  role: DashboardRole;
  nextVisitAppointment?: CarePlanAppointment | null;
  summaryAppointment?: CarePlanAppointment | null;
  currentMedication?: string | null;
  doctorSummary?: string | null;
  followUpStatus?: string | null;
};

function formatFollowUpStatus(status?: string | null) {
  if (!status) {
    return "No follow-up scheduled.";
  }

  switch (status) {
    case "PENDING":
      return "Awaiting confirmation.";
    case "CONFIRMED":
      return "Confirmed.";
    case "COMPLETED":
      return "Completed.";
    case "CANCELLED":
      return "Cancelled.";
    default:
      return status;
  }
}

export function buildCarePlanSnapshot({
  role,
  nextVisitAppointment,
  summaryAppointment,
  currentMedication,
  doctorSummary,
  followUpStatus,
}: CarePlanSource): CarePlanSnapshot {
  const nextVisit = nextVisitAppointment?.scheduledAt
    ? `${formatDateTime(nextVisitAppointment.scheduledAt)}${nextVisitAppointment.doctor?.name ? ` · ${nextVisitAppointment.doctor.name}` : ""}`
    : "No follow-up scheduled.";

  const medication =
    currentMedication?.trim() ||
    summaryAppointment?.prescription?.trim() ||
    "No active medication on file.";

  const summary =
    doctorSummary?.trim() ||
    summaryAppointment?.notes?.trim() ||
    summaryAppointment?.reason?.trim() ||
    "No doctor summary available yet.";

  return {
    nextVisit,
    currentMedication: medication,
    doctorSummary: summary,
    followUpStatus: formatFollowUpStatus(followUpStatus || nextVisitAppointment?.status?.toString()),
    canEdit: role === "doctor",
  };
}
