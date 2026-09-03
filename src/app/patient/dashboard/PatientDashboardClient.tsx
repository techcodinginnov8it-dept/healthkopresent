"use client";

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { logoutPatient } from "@/app/actions/auth";
import { bookAppointment, confirmFollowUpAppointment, requestFollowUpReschedule } from "@/app/actions/patient";
import { authorizePatientVideoSession, endVideoSession } from "@/app/actions/video-session";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { PatientSettingsModule } from "@/components/dashboard/SettingsModule";
import {
  ChatPanel,
  EmptyState,
  FloatingConsultationCall,
  LiveConsultationPanel,
  PrescriptionList,
  StatGrid,
} from "@/components/dashboard/SharedModules";
import { useConsultationSession } from "@/hooks/useConsultationSession";
import { useDashboardModule } from "@/hooks/useDashboardModule";
import { useDashboardNotifications } from "@/hooks/useDashboardNotifications";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useWebRTC } from "@/hooks/useWebRTC";
import { formatDateTime } from "@/lib/dashboard/format";
import { downloadPrescriptionPdf } from "@/lib/prescription-pdf";
import { createDashboardNotification } from "@/lib/dashboard/notifications";
import { DEFAULT_DURATION_MINUTES, getScheduleConflict, parseAvailability } from "@/lib/scheduling";
import type {
  DashboardNotification,
  DashboardDoctor,
  DashboardPatient,
  PatientAppointment,
  PatientModuleId,
  RealtimeEvent,
} from "@/lib/dashboard/types";

type Patient = DashboardPatient & {
  createdAt: Date;
  bookings: PatientAppointment[];
};

type PatientDashboardClientProps = {
  patient: Patient;
  doctors: DashboardDoctor[];
  initialModule?: PatientModuleId;
  medicalIdUrl: string;
};

type AppointmentFeedFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled";
type MedicalAccessTab = "summary" | "assessment" | "prescriptions";
type ConsultationTimelineFilter = "all" | "upcoming" | "past";
type ConsultationHubTab = "prescriptions" | "notes" | "documents" | "requirements";

const PATIENT_MODULES = [
  "overview",
  "book",
  "live",
  "history",
  "prescriptions",
  "doctors",
  "messages",
  "notifications",
  "billing",
  "settings",
] as const satisfies readonly PatientModuleId[];

const APPOINTMENT_FILTERS: { id: AppointmentFeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const MEDICAL_ACCESS_TABS: { id: MedicalAccessTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "assessment", label: "Assessment" },
  { id: "prescriptions", label: "Prescriptions" },
];

const CONSULTATION_TIMELINE_FILTERS: { id: ConsultationTimelineFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

const CONSULTATION_HUB_TABS: { id: ConsultationHubTab; label: string }[] = [
  { id: "prescriptions", label: "Prescriptions" },
  { id: "notes", label: "Doctor's Notes" },
  { id: "documents", label: "Medical Documents" },
  { id: "requirements", label: "Requirements" },
];

function getAppointmentStatusStyle(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "COMPLETED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatAppointmentFeedDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatAppointmentFeedTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatPhilippinePeso(value?: number | null) {
  if (!value) {
    return "Not listed";
  }

  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function getMedicalBullets(value?: string | null) {
  return (value || "")
    .split(/\n|\. /)
    .map((item) => item.replace(/\.$/, "").trim())
    .filter(Boolean);
}

function getAgeFromDob(dob: string) {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

type MedicalInfoFieldProps = {
  icon: ReactNode;
  label: string;
  value: string;
  emphasized?: boolean;
};

function MedicalInfoField({ icon, label, value, emphasized = false }: MedicalInfoFieldProps) {
  return (
    <div
      className={[
        "flex items-start gap-3 rounded-2xl border p-4",
        emphasized ? "border-red-200 bg-red-50/80" : "border-slate-200 bg-slate-50",
      ].join(" ")}
    >
      <div
        className={[
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          emphasized ? "bg-red-100 text-red-700" : "bg-white text-brand-teal shadow-sm",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</dt>
        <dd className={["mt-1 break-all text-sm font-bold leading-snug", emphasized ? "text-red-900" : "text-slate-900"].join(" ")}>
          {value}
        </dd>
      </div>
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isDoctorFollowUp(appointment: PatientAppointment) {
  return appointment.reason?.toLowerCase().startsWith("follow-up") || appointment.notes?.includes("Follow-up requested by doctor");
}

function extractComplaintAndNotes(rawReason?: string | null) {
  if (!rawReason) {
    return {
      complaint: "",
      notes: "",
    };
  }

  const separator = /\n\n(?:Patient Notes|Notes|Suspected Causes|Patient's Notes):\s*/i;
  const match = rawReason.split(separator);
  if (match.length > 1) {
    return {
      complaint: match[0].trim(),
      notes: match.slice(1).join("\n\n").trim(),
    };
  }

  if (rawReason.includes(" | Patient Notes: ")) {
    const [c, ...rest] = rawReason.split(" | Patient Notes: ");
    return {
      complaint: c.trim(),
      notes: rest.join(" | Patient Notes: ").trim(),
    };
  }

  return {
    complaint: rawReason.trim(),
    notes: "",
  };
}

function downloadMedicalReport(appointment: PatientAppointment, patient?: DashboardPatient) {
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Patient";
  const patientAge = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "Adult";

  downloadPrescriptionPdf({
    appointmentId: appointment.id,
    doctorName: appointment.doctor.name,
    doctorSpecialty: appointment.doctor.specialty,
    doctorLicense: appointment.doctor.licenseNumber,
    doctorNpi: appointment.doctor.npi,
    clinicName: `CLINIC OF DR. ${appointment.doctor.name.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`,
    patientName,
    patientAge,
    patientGender: patient?.gender,
    patientAddress: patient?.address ? `${patient.address}, ${patient.city || ""}` : undefined,
    date: appointment.scheduledAt,
    diagnosis: appointment.reason,
    prescription:
      appointment.prescription ||
      (appointment.notes ? `Clinical Assessment & Plan:\n${appointment.notes}` : "Consultation completed - No prescription issued."),
  });
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getMiniCalendarDays(anchorDate: Date) {
  const monthStart = startOfMonth(anchorDate);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function hasPatientScheduleConflict(appointments: PatientAppointment[], scheduledAt: Date) {
  const requestedStart = scheduledAt.getTime();
  const requestedEnd = requestedStart + DEFAULT_DURATION_MINUTES * 60 * 1000;

  return appointments.some((appointment) => {
    if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
      return false;
    }

    const appointmentStart = new Date(appointment.scheduledAt).getTime();
    const appointmentEnd = appointmentStart + (appointment.duration || DEFAULT_DURATION_MINUTES) * 60 * 1000;
    return requestedStart < appointmentEnd && requestedEnd > appointmentStart;
  });
}

function getSmartSchedulingSuggestions({
  doctor,
  appointments,
  referenceDate,
}: {
  doctor?: DashboardDoctor;
  appointments: PatientAppointment[];
  referenceDate: Date;
}) {
  const availability = parseAvailability(doctor?.availability);
  const suggestions: Date[] = [];
  const startHour = availability ? Math.ceil(availability.startMinutes / 60) : 9;
  const endHour = availability ? Math.floor((availability.endMinutes - DEFAULT_DURATION_MINUTES) / 60) : 16;
  const confirmedAppointments = appointments.filter((appointment) => appointment.status === "CONFIRMED");

  for (let dayOffset = 0; dayOffset < 21 && suggestions.length < 5; dayOffset += 1) {
    const day = new Date(referenceDate);
    day.setDate(referenceDate.getDate() + dayOffset);
    day.setMinutes(0, 0, 0);

    if (availability && !availability.days.includes(day.getDay())) {
      continue;
    }

    for (let hour = startHour; hour <= endHour && suggestions.length < 5; hour += 1) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);

      if (slot <= referenceDate) {
        continue;
      }

      if (hasPatientScheduleConflict(appointments, slot)) {
        continue;
      }

      if (getScheduleConflict(confirmedAppointments, slot, DEFAULT_DURATION_MINUTES)) {
        continue;
      }

      suggestions.push(slot);
    }
  }

  return suggestions;
}

function PatientQrCode({ svgMarkup }: { svgMarkup: string }) {
  return (
    <div
      className="grid h-44 w-44 place-items-center rounded-3xl border border-slate-200 bg-white p-3 shadow-inner ring-1 ring-slate-950/5 sm:h-48 sm:w-48 [&>svg]:h-full [&>svg]:w-full"
      role="img"
      aria-label="Secure patient medical information QR code"
    >
      {svgMarkup ? (
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
      ) : (
        <div className="grid h-full w-full place-items-center rounded-xl bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Generating QR
        </div>
      )}
    </div>
  );
}

function downloadSvgAsFile(svgMarkup: string, filename: string) {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function PatientAppointmentMiniCalendar({
  anchorDate,
  selectedDate,
  appointments,
  onAnchorDateChange,
  onDateSelect,
}: {
  anchorDate: Date;
  selectedDate: string;
  appointments: PatientAppointment[];
  onAnchorDateChange: (date: Date) => void;
  onDateSelect: (date: string) => void;
}) {
  const days = getMiniCalendarDays(anchorDate);
  const appointmentCounts = appointments.reduce<Record<string, number>>((acc, appointment) => {
    const key = toDateKey(new Date(appointment.scheduledAt));
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const currentMonth = anchorDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(anchorDate);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Mini Calendar</p>
          <h3 className="text-base font-black text-slate-950">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAnchorDateChange(startOfMonth(addMonths(anchorDate, -1)))}
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            aria-label="Previous month"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onAnchorDateChange(startOfMonth(addMonths(anchorDate, 1)))}
            className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            aria-label="Next month"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m9 18 6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-0.5 text-center text-[10px] font-black uppercase text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const key = toDateKey(day);
          const count = appointmentCounts[key] || 0;
          const selected = key === selectedDate;
          const muted = day.getMonth() !== currentMonth;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onDateSelect(key)}
              className={`flex h-10 flex-col justify-between rounded-lg border p-1 text-left transition ${
                selected
                  ? "border-brand-teal bg-brand-teal text-white shadow-xs"
                  : muted
                  ? "border-transparent bg-slate-50/50 text-slate-300 hover:bg-slate-100/60"
                  : "border-slate-100 bg-slate-50/80 text-slate-800 hover:border-slate-200"
              }`}
            >
              <span className={`text-[11px] font-black leading-none ${selected ? "text-white" : muted ? "text-slate-300" : "text-slate-900"}`}>
                {day.getDate()}
              </span>
              {count > 0 && (
                <span className={`self-end rounded-full px-1 py-0.2 text-[9px] font-black leading-none ${selected ? "bg-white text-brand-teal" : "bg-brand-teal text-white"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DoctorProfileModal({
  doctor,
  onClose,
}: {
  doctor: DashboardDoctor;
  onClose: () => void;
}) {
  const initials = doctor.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="doctor-profile-title">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex min-w-0 items-center gap-4">
            {doctor.image ? (
              <Image src={doctor.image} alt={doctor.name} width={64} height={64} unoptimized className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-lg font-black text-brand-teal">
                {initials || "DR"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Doctor Profile</p>
              <h2 id="doctor-profile-title" className="mt-1 text-2xl font-black text-slate-950">{doctor.name}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{doctor.specialty}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50" aria-label="Close doctor profile">
            X
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          {[
            { label: "Verification", value: doctor.isVerified ? "Verified" : "Pending verification" },
            { label: "License", value: doctor.licenseNumber ? `${doctor.licenseNumber}${doctor.licenseState ? ` / ${doctor.licenseState}` : ""}` : "Not provided" },
            { label: "Experience", value: doctor.yearsExp ? `${doctor.yearsExp} years` : "Not provided" },
            { label: "Availability", value: doctor.availability || "Available by appointment" },
            { label: "NPI", value: doctor.npi || "Not provided" },
            { label: "Consult Fee", value: formatPhilippinePeso(doctor.consultFee) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="mt-1 text-sm font-black text-slate-800">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Professional Biography</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
            {doctor.bio || "This doctor has not added a professional biography yet."}
          </p>
        </div>
      </section>
    </div>
  );
}

export default function PatientDashboardClient({ patient, doctors, initialModule = "overview", medicalIdUrl }: PatientDashboardClientProps) {
  const router = useRouter();
  const [activeModule, setActiveModule] = useDashboardModule<PatientModuleId>(initialModule, PATIENT_MODULES);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState((doctors.find((d) => d.isVerified) ?? doctors[0])?.id || "");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [reason, setReason] = useState("");
  const [patientNotes, setPatientNotes] = useState("");
  const [authorizedRooms, setAuthorizedRooms] = useState<Record<string, string>>({});
  const [startedAppointmentId, setStartedAppointmentId] = useState("");
  const [joiningAppointmentId, setJoiningAppointmentId] = useState("");
  const [dismissedStartedId, setDismissedStartedId] = useState("");
  const [blockedAppointment, setBlockedAppointment] = useState<PatientAppointment | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [noShowModal, setNoShowModal] = useState<{
    isOpen: boolean;
    appointmentId: string;
    doctorName: string;
    doctorId?: string;
  } | null>(null);
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFeedFilter>("all");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [consultationFilter, setConsultationFilter] = useState<ConsultationTimelineFilter>("all");
  const [consultationHubTab, setConsultationHubTab] = useState<ConsultationHubTab>("prescriptions");
  const [profileDoctor, setProfileDoctor] = useState<DashboardDoctor | null>(null);
  const [selectedMedicalAppointmentId, setSelectedMedicalAppointmentId] = useState("");
  const [medicalAccessTab, setMedicalAccessTab] = useState<MedicalAccessTab>("summary");
  const [followUpActionId, setFollowUpActionId] = useState("");
  const [rescheduleAppointment, setRescheduleAppointment] = useState<PatientAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [appointmentCalendarAnchor, setAppointmentCalendarAnchor] = useState(() => startOfMonth(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [appointmentReferenceTime] = useState(() => new Date());
  const [medicalIdQrSvg, setMedicalIdQrSvg] = useState("");
  const [medicalIdAction, setMedicalIdAction] = useState<"idle" | "copied" | "downloaded">("idle");
  const [bookingState, setBookingState] = useState<{ loading: boolean; error: string; success: string }>({
    loading: false,
    error: "",
    success: "",
  });
  const [toasts, setToasts] = useState<{ id: string; tone: "success" | "error"; message: string }[]>([]);
  const [liveConsultationNotes, setLiveConsultationNotes] = useState<string | null>(null);
  const [livePrescription, setLivePrescription] = useState<string | null>(null);
  const [callExtendedMinutes, setCallExtendedMinutes] = useState(0);

  const showToast = useCallback((tone: "success" | "error", message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    let active = true;

    QRCode.toString(medicalIdUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 256,
    })
      .then((svg) => {
        if (active) {
          setMedicalIdQrSvg(svg);
        }
      })
      .catch((error) => {
        console.error("Failed to generate medical ID QR code:", error);
        if (active) {
          setMedicalIdQrSvg("");
        }
      });

    return () => {
      active = false;
    };
  }, [medicalIdUrl]);

  // Ref holding the set of this patient's appointmentIds â€” used inside the
  // Keep ref of bookings and appointment IDs accessible in socket event callbacks
  const patientAppointmentIdsRef = React.useRef<Set<string>>(new Set());
  const patientBookingsRef = React.useRef(patient.bookings);
  patientBookingsRef.current = patient.bookings;

  const onRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (
      event.actorRole === "doctor" &&
      (
        event.type === "appointment:updated" ||
        event.type === "appointment:created" ||
        event.type === "appointment:rescheduled" ||
        event.type === "appointment:cancelled" ||
        event.type === "appointment:referred" ||
        event.type === "session:started" ||
        event.type === "session:ended" ||
        event.type === "session:extended" ||
        event.type === "notification:new"
      )
    ) {
      if (event.type === "appointment:updated") {
        if (!patientAppointmentIdsRef.current.has(event.appointmentId)) {
          return;
        }
        if (event.notes !== undefined) {
          setLiveConsultationNotes(event.notes);
        }
        if (event.prescription !== undefined) {
          setLivePrescription(event.prescription);
        }
        if (event.notes || event.prescription) {
          showToast("success", "Your doctor updated your consultation notes and prescription.");
        }
      }

      if (event.type === "session:extended") {
        if (!patientAppointmentIdsRef.current.has(event.appointmentId)) {
          return;
        }
        setCallExtendedMinutes((prev) => prev + (event.extendedMinutes || 0));
        showToast("success", event.body || `Consultation extended by ${event.extendedMinutes || 30} minutes.`);
      }

      if (event.type === "appointment:cancelled") {
        if (!patientAppointmentIdsRef.current.has(event.appointmentId)) {
          return;
        }
        if (
          event.title?.toLowerCase().includes("no show") ||
          event.body?.toLowerCase().includes("no show")
        ) {
          const booked = patientBookingsRef.current.find((b) => b.id === event.appointmentId);
          showToast("error", event.body || "Your consultation was marked as No Show. Please book a new consultation.");
          setNoShowModal({
            isOpen: true,
            appointmentId: event.appointmentId,
            doctorName: booked?.doctor.name || "your doctor",
            doctorId: booked?.doctor.id,
          });
        }
      }

      if (event.type === "session:started" && event.roomId) {
        // Only act if this appointment belongs to this patient.
        if (!patientAppointmentIdsRef.current.has(event.appointmentId)) {
          console.log(`[PatientDashboard] session:started ignored — appointmentId ${event.appointmentId} not in this patient's bookings`);
          return;
        }
        console.log(`[PatientDashboard] session:started received for appointmentId=${event.appointmentId} roomId=${event.roomId}`);
        setAuthorizedRooms((current) => ({ ...current, [event.appointmentId]: event.roomId || "" }));
        if (dismissedStartedId !== event.appointmentId) {
          setStartedAppointmentId(event.appointmentId);
        }
      }

      if (event.type === "session:ended") {
        if (!patientAppointmentIdsRef.current.has(event.appointmentId)) {
          return;
        }
        console.log(`[PatientDashboard] session:ended received for appointmentId=${event.appointmentId}`);
        setLiveConsultationNotes(null);
        setLivePrescription(null);
        setCallExtendedMinutes(0);
        setStartedAppointmentId((current) => current === event.appointmentId ? "" : current);
        setJoiningAppointmentId((current) => current === event.appointmentId ? "" : current);
        setDismissedStartedId((current) => current === event.appointmentId ? "" : current);
        setBlockedAppointment((current) => current?.id === event.appointmentId ? null : current);
        setAuthorizedRooms((current) => {
          if (!current[event.appointmentId]) {
            return current;
          }

          const next = { ...current };
          delete next[event.appointmentId];
          return next;
        });
      }
      router.refresh();
    }
  }, [dismissedStartedId, router, showToast]);

  const realtime = useDashboardRealtime(onRealtimeEvent);
  const session = useConsultationSession<PatientAppointment>({
    role: "patient",
    publish: realtime.publish,
    persistKey: `healthko:patient:${patient.id}:active-consultation`,
  });
  const isLiveConsultationActive = Boolean(session.roomId && (session.status === "waiting" || session.status === "connected"));

  // Keep the appointment-ID ref in sync so the socket callback can filter
  // without needing the full appointments array as a dependency.
  useEffect(() => {
    patientAppointmentIdsRef.current = new Set(patient.bookings.map((b) => b.id));
  }, [patient.bookings]);

  // Hydrate authorizedRooms from server data on initial load and every refresh.
  // This lets patients join a session that the doctor started before the patient
  // opened their dashboard (no socket event available in that case).
  // Also triggers the "Doctor started your consultation" modal (startedAppointmentId).
  useEffect(() => {
    const rooms: Record<string, string> = {};
    let firstStartedId = "";

    for (const booking of patient.bookings) {
      if (booking.status === "CONFIRMED" && booking.videoSession?.status === "STARTED" && booking.videoSession.roomId) {
        rooms[booking.id] = booking.videoSession.roomId;
        console.log(`[PatientDashboard] Hydrating room from DB: appointmentId=${booking.id} roomId=${booking.videoSession.roomId}`);
        // Pick the first un-dismissed started appointment to surface the join modal.
        if (!firstStartedId && booking.id !== dismissedStartedId) {
          firstStartedId = booking.id;
        }
      }
    }

    if (Object.keys(rooms).length > 0) {
      Promise.resolve().then(() => {
        setAuthorizedRooms((current) => ({ ...rooms, ...current }));
      });
    }

    if (firstStartedId) {
      console.log(`[PatientDashboard] Showing join modal for appointmentId=${firstStartedId}`);
      Promise.resolve().then(() => {
        setStartedAppointmentId(firstStartedId);
      });
    }
  // dismissedStartedId intentionally omitted: we only want to re-evaluate when
  // the server data changes (router.refresh), not when the user dismisses.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.bookings]);

  const webRTC = useWebRTC({
    roomId: session.roomId,
    role: "patient",
    isCameraOn: session.isCameraOn,
    isMicOn: session.isMicOn,
    isActive: isLiveConsultationActive,
    onRemoteSessionEnded: () => {
      session.endSession(false);
      setStartedAppointmentId("");
      setJoiningAppointmentId("");
      setBlockedAppointment(null);
      setActiveModule("overview");
    },
  });
  const receiveRealtimeEvent = session.receiveRealtimeEvent;
  const handleToggleScreenShare = useCallback(async () => {
    if (webRTC.isScreenSharing) {
      await webRTC.stopScreenShare();
      session.setScreenSharing(false);
      return;
    }

    const started = await webRTC.startScreenShare();
    if (started) {
      session.setScreenSharing(true);
    }
  }, [session, webRTC.isScreenSharing, webRTC.startScreenShare, webRTC.stopScreenShare]);

  const handleCopyMedicalIdLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(medicalIdUrl);
      setMedicalIdAction("copied");
      showToast("success", "Medical profile link copied.");
      window.setTimeout(() => setMedicalIdAction("idle"), 2000);
    } catch {
      showToast("error", "Could not copy the medical profile link.");
    }
  }, [medicalIdUrl, showToast]);

  const handleDownloadMedicalIdQr = useCallback(() => {
    if (!medicalIdQrSvg) {
      showToast("error", "QR code is still generating.");
      return;
    }

    downloadSvgAsFile(medicalIdQrSvg, `healthko-medical-id-${patient.id}.svg`);
    setMedicalIdAction("downloaded");
    showToast("success", "QR code downloaded.");
    window.setTimeout(() => setMedicalIdAction("idle"), 2000);
  }, [medicalIdQrSvg, patient.id, showToast]);

  useEffect(() => {
    receiveRealtimeEvent(realtime.lastEvent);
  }, [realtime.lastEvent, receiveRealtimeEvent]);

  const appointments = useMemo(
    () => [...patient.bookings].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [patient.bookings]
  );
  const upcomingAppointments = useMemo(
    () => appointments.filter((booking) => new Date(booking.scheduledAt) >= appointmentReferenceTime && booking.status !== "CANCELLED"),
    [appointmentReferenceTime, appointments]
  );
  const confirmedAppointments = useMemo(
    () => upcomingAppointments.filter((booking) => booking.status === "CONFIRMED"),
    [upcomingAppointments]
  );
  const historicalAppointments = useMemo(
    () =>
      [...appointments]
        .filter((booking) => booking.status === "COMPLETED" || booking.status === "CANCELLED" || new Date(booking.scheduledAt) < appointmentReferenceTime)
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [appointmentReferenceTime, appointments]
  );
  const prescriptions = useMemo(
    () => appointments.filter((booking) => booking.prescription),
    [appointments]
  );
  const currentLiveBooking = useMemo(() => {
    if (!session.activeAppointment) return null;
    return appointments.find((b) => b.id === session.activeAppointment?.id) || session.activeAppointment;
  }, [appointments, session.activeAppointment]);

  useEffect(() => {
    if (session.activeAppointment) {
      const match = patient.bookings.find((b) => b.id === session.activeAppointment?.id);
      if (session.activeAppointment.notes || match?.notes) {
        setLiveConsultationNotes(session.activeAppointment.notes || match?.notes || null);
      }
      if (session.activeAppointment.prescription || match?.prescription) {
        setLivePrescription(session.activeAppointment.prescription || match?.prescription || null);
      }
    } else {
      setLiveConsultationNotes(null);
      setLivePrescription(null);
      setCallExtendedMinutes(0);
    }
  }, [session.activeAppointment?.id, session.activeAppointment?.notes, session.activeAppointment?.prescription, patient.bookings]);

  const activeConsultationNotes = liveConsultationNotes ?? currentLiveBooking?.notes ?? session.activeAppointment?.notes ?? null;
  const activePrescription = livePrescription ?? currentLiveBooking?.prescription ?? session.activeAppointment?.prescription ?? null;

  const handleExtendCall = useCallback((additionalMinutes: number, newTotalMinutes: number) => {
    setCallExtendedMinutes((prev) => prev + additionalMinutes);
    if (session.activeAppointment) {
      realtime.publish({
        type: "session:extended",
        appointmentId: session.activeAppointment.id,
        actorRole: "patient",
        extendedMinutes: additionalMinutes,
        newTotalDuration: newTotalMinutes,
        title: "Consultation extended",
        body: `The patient requested to extend the consultation by ${additionalMinutes} minutes.`,
      });
      showToast("success", `Consultation extended by ${additionalMinutes} minutes (New total: ${newTotalMinutes} mins).`);
    }
  }, [realtime, session.activeAppointment, showToast]);


  const appointmentFeed = useMemo(() => {
    const filtered = appointmentFilter === "all"
      ? appointments
      : appointments.filter((booking) => booking.status.toLowerCase() === appointmentFilter);
    const dateFiltered = selectedCalendarDate
      ? filtered.filter((booking) => toDateKey(new Date(booking.scheduledAt)) === selectedCalendarDate)
      : filtered;

    return [...dateFiltered].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [appointmentFilter, appointments, selectedCalendarDate]);
  const selectedAppointment = useMemo(() => {
    return (
      appointments.find((booking) => booking.id === selectedAppointmentId) ||
      appointmentFeed[0] ||
      upcomingAppointments[0] ||
      appointments[0] ||
      null
    );
  }, [appointmentFeed, appointments, selectedAppointmentId, upcomingAppointments]);
  const consultationTimeline = useMemo(() => {
    const filtered = appointments.filter((booking) => {
      if (consultationFilter === "upcoming") {
        return new Date(booking.scheduledAt) >= appointmentReferenceTime && booking.status !== "CANCELLED" && booking.status !== "COMPLETED";
      }

      if (consultationFilter === "past") {
        return booking.status === "COMPLETED" || booking.status === "CANCELLED" || new Date(booking.scheduledAt) < appointmentReferenceTime;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      const first = new Date(a.scheduledAt).getTime();
      const second = new Date(b.scheduledAt).getTime();

      return consultationFilter === "past" ? second - first : first - second;
    });
  }, [appointmentReferenceTime, appointments, consultationFilter]);
  const medicalAccessAppointments = useMemo(
    () => historicalAppointments.length ? historicalAppointments : [...appointments].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [appointments, historicalAppointments]
  );
  const selectedMedicalAppointment = useMemo(
    () =>
      medicalAccessAppointments.find((booking) => booking.id === selectedMedicalAppointmentId) ||
      medicalAccessAppointments[0] ||
      null,
    [medicalAccessAppointments, selectedMedicalAppointmentId]
  );
  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === selectedDoctorId),
    [doctors, selectedDoctorId]
  );
  const selectedAppointmentDoctor = useMemo(
    () => selectedAppointment ? doctors.find((doctor) => doctor.id === selectedAppointment.doctor.id) : undefined,
    [doctors, selectedAppointment]
  );
  const schedulingSuggestions = useMemo(
    () => getSmartSchedulingSuggestions({
      doctor: selectedDoctor,
      appointments,
      referenceDate: appointmentReferenceTime,
    }),
    [appointmentReferenceTime, appointments, selectedDoctor]
  );
  const requestedDateTime = appointmentDate && appointmentTime ? new Date(`${appointmentDate}T${appointmentTime}:00`) : null;
  const patientConflict = requestedDateTime && !Number.isNaN(requestedDateTime.getTime())
    ? hasPatientScheduleConflict(appointments, requestedDateTime)
    : false;
  const notificationSeed = useMemo<DashboardNotification[]>(
    () => [
      ...patient.bookings
        .filter((b) => b.status === "CANCELLED" && b.notes?.toLowerCase().includes("no show"))
        .slice(0, 3)
        .map((booking) =>
          createDashboardNotification({
            id: `patient-noshow-${booking.id}`,
            title: "Consultation marked as No Show",
            body: `You were marked as No Show for your scheduled consultation with ${booking.doctor.name}. Please book a new consultation.`,
            kind: "appointment",
            createdAt: booking.createdAt,
            readAt: null,
          })
        ),
      ...upcomingAppointments.slice(0, 3).map((booking) =>
        createDashboardNotification({
          id: `patient-appointment-${booking.id}`,
          title: `${booking.status.toLowerCase()} appointment`,
          body: `${booking.doctor.name} / ${formatDateTime(booking.scheduledAt)}`,
          kind: booking.status === "CONFIRMED" ? "consultation" : "appointment",
          createdAt: booking.createdAt,
          readAt: booking.status === "PENDING" ? null : booking.createdAt,
        })
      ),
      ...prescriptions.slice(0, 2).map((booking) =>
        createDashboardNotification({
          id: `patient-prescription-${booking.id}`,
          title: "Prescription available",
          body: `${booking.prescription} from ${booking.doctor.name}`,
          kind: "prescription",
          createdAt: booking.createdAt,
          readAt: null,
        })
      ),
    ],
    [prescriptions, upcomingAppointments]
  );
  const dashboardNotifications = useDashboardNotifications({
    role: "patient",
    initialNotifications: notificationSeed,
    realtimeEvent: realtime.lastEvent,
  });

  const navItems: DashboardNavItem<PatientModuleId>[] = [
    { id: "overview", label: "Overview" },
    { id: "book", label: "Appointments" },
    { id: "live", label: "Consultations", badge: confirmedAppointments.length || undefined },
    { id: "history", label: "Medical Access", badge: prescriptions.length || undefined },
    { id: "settings", label: "Settings" },
  ];

  const handleBookAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDoctorId || !appointmentDate || !appointmentTime || !reason.trim()) {
      showToast("error", "Choose a doctor, date, time, and visit reason.");
      setBookingState({ loading: false, error: "", success: "" });
      return;
    }

    if (patientConflict) {
      showToast("error", "You already have an appointment in this time window. Choose another slot.");
      setBookingState({ loading: false, error: "", success: "" });
      return;
    }

    setBookingState({ loading: true, error: "", success: "" });
    const combinedReason = patientNotes.trim()
      ? `${reason.trim()}\n\nPatient Notes: ${patientNotes.trim()}`
      : reason.trim();

    const result = await bookAppointment({
      doctorId: selectedDoctorId,
      scheduledAt: `${appointmentDate}T${appointmentTime}:00`,
      reason: combinedReason,
    });

    if (!result.success) {
      const errorMessage = "error" in result ? result.error : "";
      showToast("error", errorMessage || "Could not book appointment.");
      setBookingState({ loading: false, error: "", success: "" });
      return;
    }

    realtime.publish({
      type: "appointment:created",
      appointmentId: result.consultation?.id || "pending",
      actorRole: "patient",
      targetDoctorId: result.consultation?.doctorId || selectedDoctorId,
      scheduledAt: `${appointmentDate}T${appointmentTime}:00`,
      title: "New appointment request",
      body: "A patient submitted a consultation request for review.",
    });
    showToast("success", "Appointment request sent to the doctor.");
    setBookingState({ loading: false, error: "", success: "" });
    setAppointmentDate("");
    setAppointmentTime("");
    setReason("");
    setPatientNotes("");
    setIsBookingOpen(false);
    setActiveModule("book");
    router.refresh();
  };

  const joinAuthorizedSession = async (targetAppointment?: PatientAppointment) => {
    const appointment = targetAppointment || session.activeAppointment;

    if (!appointment) {
      return;
    }

    setJoiningAppointmentId(appointment.id);

    console.log("[PatientDashboard] authorizePatientVideoSession starting for", appointment.id);
    const result = await authorizePatientVideoSession(appointment.id);
    console.log("[PatientDashboard] authorizePatientVideoSession result:", result);

    if (!result.success || !result.roomId || !result.accessToken) {
      console.error("[PatientDashboard] Authorization failed:", result.error);
      showToast("error", result.error || "Could not authorize video room access.");
      setJoiningAppointmentId("");
      setBlockedAppointment(appointment);
      setActiveModule("live");
      return;
    }

    setStartedAppointmentId("");
    setDismissedStartedId(appointment.id);
    setJoiningAppointmentId("");
    setBlockedAppointment(null);
    session.enterAuthorizedRoom(appointment, result.roomId, result.accessToken);

    setActiveModule("live");
    realtime.publish({
      type: "session:joined",
      appointmentId: appointment.id,
      actorRole: "patient",
      roomId: result.roomId,
    });
  };

  const handleConfirmFollowUp = async (appointment: PatientAppointment) => {
    setFollowUpActionId(appointment.id);
    const result = await confirmFollowUpAppointment(appointment.id);
    setFollowUpActionId("");

    if (!result.success) {
      const errorMessage = "error" in result ? result.error : "";
      showToast("error", errorMessage || "Could not confirm follow-up appointment.");
      setBookingState({ loading: false, error: "", success: "" });
      return;
    }

    realtime.publish({
      type: "appointment:updated",
      appointmentId: appointment.id,
      actorRole: "patient",
      targetDoctorId: result.consultation?.doctorId || appointment.doctor.id,
      title: "Follow-up confirmed",
      body: "The patient confirmed the follow-up appointment.",
    });
    showToast("success", "Follow-up appointment confirmed.");
    setBookingState({ loading: false, error: "", success: "" });
    router.refresh();
  };

  const openFollowUpReschedule = (appointment: PatientAppointment) => {
    const currentDate = new Date(appointment.scheduledAt);
    const nextDate = Number.isNaN(currentDate.getTime()) ? new Date() : currentDate;

    setRescheduleAppointment(appointment);
    setRescheduleDate(toDateKey(nextDate));
    setRescheduleTime(toTimeValue(nextDate));
    setBookingState({ loading: false, error: "", success: "" });
  };

  const handleRequestFollowUpReschedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rescheduleAppointment || !rescheduleDate || !rescheduleTime) {
      showToast("error", "Choose your requested follow-up date and time.");
      setBookingState({ loading: false, error: "", success: "" });
      return;
    }

    const requestedDate = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
    if (Number.isNaN(requestedDate.getTime()) || requestedDate <= appointmentReferenceTime) {
      showToast("error", "Choose a valid future date and time.");
      setBookingState({ loading: false, error: "", success: "" });
      return;
    }

    const appointment = rescheduleAppointment;
    setFollowUpActionId(appointment.id);
    const result = await requestFollowUpReschedule({
      consultationId: appointment.id,
      requestedScheduledAt: requestedDate.toISOString(),
    });
    setFollowUpActionId("");

    if (!result.success) {
      const errorMessage = "error" in result ? result.error : "";
      showToast("error", errorMessage || "Could not request follow-up rescheduling.");
      setBookingState({ loading: false, error: "", success: "" });
      return;
    }

    realtime.publish({
      type: "appointment:rescheduled",
      appointmentId: appointment.id,
      actorRole: "patient",
      targetDoctorId: result.consultation?.doctorId || appointment.doctor.id,
      scheduledAt: requestedDate.toISOString(),
      title: "Reschedule requested",
      body: `The patient requested ${formatDateTime(requestedDate)} for the follow-up consultation.`,
    });
    showToast("success", "Reschedule request sent to the doctor.");
    setBookingState({ loading: false, error: "", success: "" });
    setRescheduleAppointment(null);
    setRescheduleDate("");
    setRescheduleTime("");
    router.refresh();
  };

  const startLiveSession = (appointment: PatientAppointment) => {
    // If already pre-joined in the background, just reveal the live UI.
    if (session.roomId && session.activeAppointment?.id === appointment.id) {
      setDismissedStartedId(appointment.id);
      setActiveModule("live");
      return;
    }

    if (authorizedRooms[appointment.id]) {
      void joinAuthorizedSession(appointment);
      return;
    }

    setBlockedAppointment(appointment);
    setActiveModule("live");
  };

  const handleEndSession = async () => {
    const roomId = session.roomId;
    if (session.activeAppointment) {
      await endVideoSession(session.activeAppointment.id);
    }
    if (roomId) {
      realtime.endVideoRoom(roomId);
    }
    session.endSession();
    setStartedAppointmentId("");
    setJoiningAppointmentId("");
    setBlockedAppointment(null);
    setActiveModule("overview");
    router.refresh();
  };

  const tone = "light" as const;
  const startedAppointment = startedAppointmentId
    ? appointments.find((booking) => booking.id === startedAppointmentId)
    : undefined;
  const completedAppointments = appointments.filter((booking) => booking.status === "COMPLETED");
  const recentDoctorNames = Array.from(new Set(appointments.map((booking) => booking.doctor.name))).slice(0, 4);
  const patientAddress = [patient.address, patient.city, patient.state, patient.zipCode, patient.country].filter(Boolean).join(", ");
  const patientMedicalSummary = {
    height: patient.height || "Not recorded",
    weight: patient.weight || "Not recorded",
    bloodType: patient.bloodType || "Not recorded",
    allergies: patient.allergies || "Not recorded",
    conditions: patient.existingConditions || "Not recorded",
    medications: patient.currentMedications || "Not recorded",
    emergencyContact: [patient.emergencyContactName, patient.emergencyContactRelation, patient.emergencyContactPhone].filter(Boolean).join(" / ") || "Not recorded",
  };
  const patientAge = getAgeFromDob(patient.dob);
  const identityFields = [
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      ),
      label: "Name",
      value: `${patient.firstName} ${patient.lastName}`,
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="M9 11h6" />
          <path d="M9 15h4" />
        </svg>
      ),
      label: "Gender",
      value: patient.gender || "Not specified",
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3 10h18" />
        </svg>
      ),
      label: "DOB / Age",
      value: patientAge ? `${patient.dob} â€¢ ${patientAge} years old` : patient.dob,
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16v16H4z" />
          <path d="M8 10h8" />
          <path d="M8 14h6" />
        </svg>
      ),
      label: "Email",
      value: patient.email,
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.7-3.1 19.2 19.2 0 0 1-6-6A19.8 19.8 0 0 1 2 4.1 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.2 1.1.6 2.1 1.1 3a2 2 0 0 1-.4 2.1L8.6 10.6a16 16 0 0 0 4.8 4.8l1.8-1.1a2 2 0 0 1 2.1-.4c.9.5 1.9.9 3 1.1A2 2 0 0 1 22 16.9Z" />
        </svg>
      ),
      label: "Phone",
      value: `${patient.countryCode || ""} ${patient.phone}`.trim(),
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s6-4.8 6-10a6 6 0 1 0-12 0c0 5.2 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2.5" />
        </svg>
      ),
      label: "Address",
      value: patientAddress || "No address on file",
    },
  ];
  const vitalFields = [
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19h16" />
          <path d="M7 19V9" />
          <path d="M17 19V5" />
        </svg>
      ),
      label: "Height",
      value: patientMedicalSummary.height,
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7h14l-1 10H6L5 7Z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
          <path d="M8 12h8" />
        </svg>
      ),
      label: "Weight",
      value: patientMedicalSummary.weight,
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s6-5 6-11a6 6 0 0 0-12 0c0 6 6 11 6 11Z" />
          <path d="M9.5 11.5h5" />
        </svg>
      ),
      label: "Blood type",
      value: patientMedicalSummary.bloodType,
    },
  ];
  const riskFields = [
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 4.3 2.3 18a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-13.7a2 2 0 0 0-3.4 0Z" />
        </svg>
      ),
      label: "Allergies",
      value: patientMedicalSummary.allergies,
      emphasized: true,
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12a8 8 0 1 0 16 0" />
          <path d="M12 4v5" />
          <path d="M9.5 8.5 12 11l2.5-2.5" />
        </svg>
      ),
      label: "Conditions",
      value: patientMedicalSummary.conditions,
      emphasized: true,
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4v16" />
          <path d="M16 4v16" />
          <path d="M4 8h16" />
          <path d="M4 16h16" />
        </svg>
      ),
      label: "Medications",
      value: patientMedicalSummary.medications,
      emphasized: true,
    },
  ];

  return (
    <DashboardShell
      role="patient"
      activeModule={activeModule}
      navItems={navItems}
      title={`${patient.firstName} ${patient.lastName}`}
      subtitle="Patient dashboard"
      profile={{
        name: `${patient.firstName} ${patient.lastName}`,
        detail: patient.email,
        meta: patient.emailVerified ? "Email verified" : "Email pending verification",
        image: patient.image,
        isVerified: Boolean(patient.emailVerified),
      }}
      connectionState={realtime.connectionState}
      notificationBell={
        <NotificationBell
          role="patient"
          notifications={dashboardNotifications.notifications}
          unreadCount={dashboardNotifications.unreadCount}
          onMarkAllRead={dashboardNotifications.markAllRead}
          onOpenNotifications={() => setActiveModule("notifications")}
        />
      }
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onNavigate={setActiveModule}
      onLogout={() => (
        <form action={logoutPatient}>
          <button type="submit" className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white">
            Sign Out
          </button>
        </form>
      )}
    >
      <div className="fixed right-5 top-5 z-[80] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-700"
                : "border-red-200 bg-red-50/95 text-red-700"
            }`}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>

      {profileDoctor && <DoctorProfileModal doctor={profileDoctor} onClose={() => setProfileDoctor(null)} />}

      {rescheduleAppointment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Follow-Up Reschedule</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Request a new consultation time</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Your doctor will receive this proposed date and time for review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleAppointment(null)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Close reschedule modal"
              >
                <span aria-hidden="true">X</span>
              </button>
            </div>
            <form onSubmit={handleRequestFollowUpReschedule} className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <p className="text-xs font-black text-slate-950">{rescheduleAppointment.doctor.name}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Current follow-up: {formatDateTime(rescheduleAppointment.scheduledAt)}
                </p>
              </div>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Requested Date
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Requested Time
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(event) => setRescheduleTime(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900"
                />
              </label>
              <div className="flex flex-col-reverse gap-2 md:col-span-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setRescheduleAppointment(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={followUpActionId === rescheduleAppointment.id}
                  className="rounded-lg bg-brand-teal px-4 py-2.5 text-xs font-black text-white disabled:bg-slate-300"
                >
                  {followUpActionId === rescheduleAppointment.id ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {blockedAppointment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-xl border border-brand-red/20 bg-white p-7 text-center shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-red">Room not available</p>
            <h2 className="mt-3 font-display text-2xl font-black text-slate-950">The doctor has not started this consultation yet</h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-relaxed text-slate-500">
              For your privacy and security, only the doctor can create and start the live consultation room. Please wait for the doctor to begin the session, then use the join notification when it appears.
            </p>
            <button
              type="button"
              onClick={() => setBlockedAppointment(null)}
              className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {session.activeAppointment && activeModule !== "live" && session.status === "connected" && (
        <FloatingConsultationCall
          role="patient"
          counterpartName={session.activeAppointment.doctor.name}
          status={session.status}
          isCameraOn={session.isCameraOn}
          isMicOn={session.isMicOn}
          isScreenSharing={session.isScreenSharing}
          counterpartCameraOn={session.counterpartCameraOn}
          counterpartMicOn={session.counterpartMicOn}
          counterpartScreenSharing={session.counterpartScreenSharing}
          connectedAt={session.connectedAt}
          onToggleCamera={session.toggleCamera}
          onToggleMic={session.toggleMic}
          onToggleScreenShare={handleToggleScreenShare}
          onEnd={handleEndSession}
          onOpen={() => setActiveModule("live")}
          localStream={webRTC.localStream}
          screenShareStream={webRTC.screenShareStream}
          remoteStream={webRTC.remoteStream}
          connectionState={webRTC.connectionState}
          mediaError={webRTC.error || webRTC.deviceStatus.message}
          screenShareSupported={webRTC.screenShareSupported}
        />
      )}

      {startedAppointmentId && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Doctor is ready — Join consultation"
        >
          <div className="w-full max-w-lg rounded-2xl border border-emerald-200/60 bg-white p-8 text-center shadow-2xl">
            {/* Pulsing ring icon */}
            <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
              <span className="absolute h-20 w-20 animate-ping rounded-full bg-brand-teal/15" style={{ animationDuration: "2s" }} />
              <span className="absolute h-14 w-14 animate-ping rounded-full bg-brand-teal/20" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal text-white shadow-lg">
                {/* Video call icon */}
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m16 13 5 3V8l-5 3" />
                  <rect width="14" height="10" x="2" y="7" rx="2" />
                </svg>
              </div>
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-teal">Consultation Ready</p>
            <h2 className="mt-2 font-display text-2xl font-black text-slate-950">
              {startedAppointment?.doctor.name || "Your doctor"} is waiting
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed text-slate-500">
              Your doctor has opened the secure consultation room.{" "}
              <strong className="text-slate-700">Join when you&apos;re ready</strong> — take a moment to prepare if needed.
            </p>

            {/* Privacy hint */}
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-[11px] font-semibold leading-snug text-slate-500">
                Your camera and microphone will only activate when you click <strong className="text-slate-700">Join Consultation</strong> below.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <button
                type="button"
                disabled={!startedAppointment || joiningAppointmentId === startedAppointment.id}
                onClick={() => {
                  if (startedAppointment) {
                    void joinAuthorizedSession(startedAppointment);
                  }
                }}
                className="flex-1 rounded-xl bg-brand-teal px-6 py-3 text-sm font-black text-white shadow-md transition hover:bg-teal-600 disabled:bg-slate-300 sm:max-w-[200px]"
              >
                {joiningAppointmentId === startedAppointment?.id
                  ? "Joining..."
                  : startedAppointment
                    ? "Join Consultation"
                    : "Syncing room..."}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedStartedId(startedAppointmentId);
                  setStartedAppointmentId("");
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-100 sm:max-w-[160px]"
              >
                Not now
              </button>
            </div>
            <p className="mt-4 text-[11px] text-slate-400">
              The doctor&apos;s session will remain open for up to 10 minutes.
            </p>
          </div>
        </div>
      )}

      {noShowModal?.isOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-amber-300/50 bg-white p-6 sm:p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.25em] text-amber-600">Consultation Alert</p>
            <h2 className="mt-1 font-display text-2xl font-black text-slate-950">
              Missed Consultation (No Show)
            </h2>
            <p className="mt-3 text-sm font-semibold text-slate-600 leading-relaxed">
              You were marked as <strong className="text-amber-800 font-black">No Show</strong> for your scheduled appointment with <strong className="text-slate-900">{noShowModal.doctorName}</strong>.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">
              Would you like to schedule a new consultation to continue your care?
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => setNoShowModal(null)}
                className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-3 text-xs font-black text-slate-700 hover:bg-slate-200 transition"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  if (noShowModal.doctorId) {
                    setSelectedDoctorId(noShowModal.doctorId);
                  }
                  setNoShowModal(null);
                  setIsBookingOpen(true);
                }}
                className="rounded-xl bg-brand-teal px-6 py-3 text-xs font-black text-white hover:bg-brand-teal-hover transition shadow-md shadow-brand-teal/20"
              >
                Book New Consultation
              </button>
            </div>
          </div>
        </div>
      )}

      {isBookingOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/70 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" role="dialog" aria-modal="true">
          <section className="flex w-full flex-col bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-slate-200">
            {/* Sticky modal header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:rounded-t-2xl">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Appointments</p>
                <h2 className="mt-0.5 text-xl font-black text-slate-950">Book Appointment</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Your request goes to the selected doctor queue.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 active:bg-slate-100"
                aria-label="Close booking modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable form body */}
            <form onSubmit={handleBookAppointment} className="flex flex-col flex-1 overflow-y-auto">
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Doctor</span>
                  <select
                    value={selectedDoctorId}
                    onChange={(event) => setSelectedDoctorId(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  >
                    {doctors.filter((d) => d.isVerified).map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name} — {doctor.specialty}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Date</span>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(event) => setAppointmentDate(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Time</span>
                  <input
                    type="time"
                    value={appointmentTime}
                    onChange={(event) => setAppointmentTime(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  />
                </label>
                {patientConflict && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-bold text-amber-700 md:col-span-2">
                    ⚠️ This time overlaps with one of your active consultations. Pick a suggested slot or choose another time.
                  </div>
                )}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Suggested Slots</p>
                  <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {schedulingSuggestions.length ? schedulingSuggestions.map((slot) => (
                      <button
                        key={slot.toISOString()}
                        type="button"
                        onClick={() => {
                          setAppointmentDate(toDateKey(slot));
                          setAppointmentTime(toTimeValue(slot));
                        }}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-black text-slate-700 hover:border-brand-teal hover:text-brand-teal transition-colors"
                      >
                        {formatDateTime(slot)}
                      </button>
                    )) : (
                      <span className="text-xs font-medium text-slate-500">No suggestions available for this doctor yet.</span>
                    )}
                  </div>
                </div>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Visit Reason (Chief Complaint)</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={3}
                    placeholder="Describe your symptoms or primary reason for visit..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  />
                </label>
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Patient Notes & Suspected Causes (Optional)</span>
                  <textarea
                    value={patientNotes}
                    onChange={(event) => setPatientNotes(event.target.value)}
                    rows={3}
                    placeholder="Share what you think caused this, symptom triggers, timeline, or any extra details for the doctor..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                  />
                </label>
              </div>

              {/* Sticky footer */}
              <div className="border-t border-slate-100 p-5 sm:rounded-b-2xl">
                {bookingState.error && (
                  <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">{bookingState.error}</p>
                )}
                {bookingState.success && (
                  <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">{bookingState.success}</p>
                )}
                <button
                  type="submit"
                  disabled={bookingState.loading}
                  className="w-full rounded-xl bg-brand-teal py-3.5 text-sm font-black text-white shadow-md shadow-brand-teal/20 transition-all hover:bg-brand-teal-hover active:scale-[0.99] disabled:bg-slate-300 disabled:shadow-none"
                >
                  {bookingState.loading ? "Sending request…" : "Send Appointment Request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {activeModule === "overview" && (
        <div className="space-y-6">
          <StatGrid
            stats={[
              { label: "Upcoming Consultations", value: upcomingAppointments.length, helper: "scheduled and requested visits" },
              { label: "Recent Doctors", value: recentDoctorNames.length, helper: "clinicians connected to your care" },
              { label: "Completed", value: completedAppointments.length, helper: "closed consultations" },
              { label: "Pending Rx", value: prescriptions.length, helper: "prescription records available" },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-12">
            <div className="flex flex-col gap-5 xl:col-span-7">
              <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-teal">Identity Profile</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Basic Patient Details</h2>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-teal-tint text-brand-teal border border-brand-teal/10">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                      <path d="M5 20a7 7 0 0 1 14 0" />
                    </svg>
                  </div>
                </div>
                <dl className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {identityFields.map((field) => (
                    <MedicalInfoField key={field.label} icon={field.icon} label={field.label} value={field.value} />
                  ))}
                </dl>
              </section>

              <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Vital Health Metrics</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Clinical Measurements</h2>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19h16" />
                      <path d="M7 19V9" />
                      <path d="M17 19V5" />
                    </svg>
                  </div>
                </div>
                <dl className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {vitalFields.map((field) => (
                    <MedicalInfoField key={field.label} icon={field.icon} label={field.label} value={field.value} />
                  ))}
                </dl>
              </section>

              <section className="overflow-hidden rounded-3xl border border-red-200/80 bg-gradient-to-br from-red-50/90 via-white to-white p-6 shadow-sm transition-all duration-300 hover:border-red-300">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-600">Clinical Risk Alerts</p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">High-Priority Medical Info</h2>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100/80 text-red-700 border border-red-200/60">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                      <path d="M10.3 4.3 2.3 18a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-13.7a2 2 0 0 0-3.4 0Z" />
                    </svg>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {riskFields.map((field) => (
                    <MedicalInfoField key={field.label} icon={field.icon} label={field.label} value={field.value} emphasized />
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-brand-teal/20 bg-gradient-to-br from-brand-teal/15 via-white to-slate-50/50 p-7 shadow-sm xl:col-span-5 flex flex-col justify-between">
              <div className="flex h-full min-h-[28rem] flex-col items-center justify-center text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-teal/20 bg-white/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal shadow-xs backdrop-blur-xs">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7a3 3 0 0 1 3-3h1" />
                    <path d="M16 4h1a3 3 0 0 1 3 3v1" />
                    <path d="M20 17v1a3 3 0 0 1-3 3h-1" />
                    <path d="M7 20H6a3 3 0 0 1-3-3v-1" />
                    <path d="M9 9h6v6H9z" />
                  </svg>
                  Digital Medical ID
                </div>

                <div className="mt-6 rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-lg ring-1 ring-slate-900/5">
                  <PatientQrCode svgMarkup={medicalIdQrSvg} />
                </div>

                <div className="mt-6 w-full max-w-sm">
                  <h3 className="text-xl font-black tracking-tight text-slate-950">Digital Medical ID</h3>
                  <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed text-slate-600">
                    Scan to securely share your medical profile with authorized clinicians anywhere, anytime.
                  </p>
                </div>

                <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={handleCopyMedicalIdLink}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-bold text-slate-800 shadow-xs transition-all hover:border-brand-teal hover:text-brand-teal active:scale-[0.99] sm:min-w-36"
                    aria-label="Copy medical profile link"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                    </svg>
                    {medicalIdAction === "copied" ? "Copied" : "Copy Link"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadMedicalIdQr}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-5 py-3.5 text-xs font-bold text-white shadow-md shadow-brand-teal/20 transition-all hover:bg-brand-teal-hover active:scale-[0.99] sm:min-w-36"
                    aria-label="Download medical QR code"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v10" />
                      <path d="m7 8 5 5 5-5" />
                      <path d="M5 19h14" />
                    </svg>
                    {medicalIdAction === "downloaded" ? "Downloaded" : "Download QR"}
                  </button>
                </div>

                <p className="mt-5 max-w-sm text-xs font-medium leading-relaxed text-slate-500">
                  Keep this ID handy for secure telehealth check-ins, message-based sharing, or a printed backup.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeModule === "book" && (
        <section className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-teal">Appointments</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Consultation Timeline</h2>
                <p className="mt-1.5 max-w-2xl text-sm font-medium text-slate-500">
                  Track requests, doctor approvals, live-room readiness, and follow-up care.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModule("doctors")}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
                >
                  Doctor Directory
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingState({ loading: false, error: "", success: "" });
                    setIsBookingOpen(true);
                  }}
                  className="rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-brand-teal/20 transition hover:bg-brand-teal-hover active:scale-[0.98]"
                >
                  + Book Appointment
                </button>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: "Pending", value: appointments.filter((item) => item.status === "PENDING").length, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
                { label: "Confirmed", value: confirmedAppointments.length, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                { label: "Completed", value: completedAppointments.length, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                { label: "Prescriptions", value: prescriptions.length, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-xl border px-4 py-3 ${stat.bg}`}>
                  <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-xl border border-slate-200 bg-white">
              <header className="border-b border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Chronological Feed</p>
                    <h3 className="text-base font-black text-slate-950">
                      {selectedCalendarDate ? `Selected Date: ${selectedCalendarDate}` : "All Appointment States"}
                    </h3>
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {APPOINTMENT_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setAppointmentFilter(filter.id)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${
                          appointmentFilter === filter.id ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                    {selectedCalendarDate && (
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarDate("")}
                        className="shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase text-white"
                      >
                        Clear Date
                      </button>
                    )}
                  </div>
                </div>
              </header>
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="max-h-[720px] space-y-3 overflow-y-auto p-4">
                  {appointmentFeed.length ? appointmentFeed.map((booking) => {
                    const isSelected = selectedAppointment?.id === booking.id;
                    const roomReady = Boolean(authorizedRooms[booking.id] || startedAppointmentId === booking.id);

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedAppointmentId(booking.id)}
                        className={`group w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-brand-teal bg-brand-teal/5 shadow-sm shadow-brand-teal/10"
                            : "border-slate-200/80 bg-white hover:border-brand-teal/30 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            {/* Doctor avatar initials */}
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-xs font-black text-brand-teal">
                              {getInitials(booking.doctor.name) || "DR"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h4 className="text-sm font-black leading-tight text-slate-950">{booking.doctor.name}</h4>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${getAppointmentStatusStyle(booking.status)}`}>
                                  {booking.status}
                                </span>
                                {roomReady && <span className="animate-pulse rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-black uppercase text-white">● Room ready</span>}
                              </div>
                              <p className="mt-1 text-xs font-bold text-brand-teal">{booking.doctor.specialty}</p>
                              {booking.reason && (
                                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-slate-600 leading-relaxed">
                                  {booking.reason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 pt-2.5 sm:border-t-0 sm:pt-0 sm:flex-col sm:items-end">
                            <time
                              dateTime={new Date(booking.scheduledAt).toISOString()}
                              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-left sm:text-right text-[11px] font-black text-slate-700"
                            >
                              <span className="block">{formatAppointmentFeedDate(booking.scheduledAt)}</span>
                              <span className="mt-0.5 block font-semibold text-slate-500">{formatAppointmentFeedTime(booking.scheduledAt)}</span>
                            </time>
                          </div>
                        </div>
                      </button>
                    );
                  }) : (
                    <EmptyState title="No appointments match this view" body="Change filters or book a new consultation request." />
                  )}
                </div>

                <aside className="border-t border-slate-200 bg-slate-50 p-4 lg:border-l lg:border-t-0">
                  {selectedAppointment ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Selected Consultation</p>
                        <h3 className="mt-1 text-lg font-black text-slate-950">{selectedAppointment.doctor.name}</h3>
                        <p className="mt-1 text-xs font-bold text-slate-500">{formatDateTime(selectedAppointment.scheduledAt)}</p>
                      </div>
                      <div className={`rounded-xl border p-3 text-xs font-bold ${
                        selectedAppointment.status === "CANCELLED" && selectedAppointment.notes?.toLowerCase().includes("no show")
                          ? "border-amber-300 bg-amber-50 text-amber-900"
                          : getAppointmentStatusStyle(selectedAppointment.status)
                      }`}>
                        {selectedAppointment.status === "PENDING" && "Waiting for doctor approval. You will be notified when this consultation is confirmed."}
                        {selectedAppointment.status === "CONFIRMED" && "Confirmed. The doctor must start the secure room before you can join."}
                        {selectedAppointment.status === "COMPLETED" && "Completed. Clinical notes and prescriptions are available from Medical Access."}
                        {selectedAppointment.status === "CANCELLED" && (
                          selectedAppointment.notes?.toLowerCase().includes("no show")
                            ? "Missed Consultation / No Show. You were marked as No Show for this scheduled consultation. Please book a new consultation to receive care."
                            : "Cancelled. You can book another appointment from the doctor directory."
                        )}
                      </div>
                      {selectedAppointment.status === "CANCELLED" && selectedAppointment.notes?.toLowerCase().includes("no show") && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedAppointment.doctor.id) {
                              setSelectedDoctorId(selectedAppointment.doctor.id);
                            }
                            setIsBookingOpen(true);
                          }}
                          className="w-full rounded-xl bg-brand-teal py-3 text-xs font-black text-white hover:bg-brand-teal-hover transition shadow-md shadow-brand-teal/20"
                        >
                          Book New Consultation
                        </button>
                      )}
                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Visit reason</dt>
                          <dd className="mt-1 font-semibold text-slate-700">{selectedAppointment.reason || "No reason provided"}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Care continuity</dt>
                          <dd className="mt-1 font-semibold text-slate-700">{selectedAppointment.prescription ? `Prescription: ${selectedAppointment.prescription}` : selectedAppointment.notes || "No notes yet"}</dd>
                        </div>
                      </dl>
                      {selectedAppointment.status === "PENDING" && isDoctorFollowUp(selectedAppointment) && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-black text-amber-800">Doctor follow-up needs your response.</p>
                          <div className="mt-3 flex flex-col gap-2">
                            <button
                              type="button"
                              disabled={followUpActionId === selectedAppointment.id}
                              onClick={() => void handleConfirmFollowUp(selectedAppointment)}
                              className="rounded-lg bg-brand-teal px-4 py-2.5 text-xs font-black text-white disabled:bg-slate-300"
                            >
                              Confirm Follow-Up
                            </button>
                            <button
                              type="button"
                              disabled={followUpActionId === selectedAppointment.id}
                              onClick={() => openFollowUpReschedule(selectedAppointment)}
                              className="rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-xs font-black text-amber-800 disabled:text-slate-400"
                            >
                              Request Reschedule
                            </button>
                          </div>
                        </div>
                      )}
                      {selectedAppointment.status === "CONFIRMED" && (
                        <button
                          type="button"
                          onClick={() => startLiveSession(selectedAppointment)}
                          className="w-full rounded-lg bg-brand-red px-4 py-3 text-xs font-black text-white"
                        >
                          {authorizedRooms[selectedAppointment.id] ? "Join Consultation" : "Check Live Room"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <EmptyState title="No appointment selected" body="Choose an appointment to see its workflow status." />
                  )}
                </aside>
              </div>
            </section>

            <aside className="space-y-4">
              <PatientAppointmentMiniCalendar
                anchorDate={appointmentCalendarAnchor}
                selectedDate={selectedCalendarDate}
                appointments={appointments}
                onAnchorDateChange={setAppointmentCalendarAnchor}
                onDateSelect={setSelectedCalendarDate}
              />
            </aside>
          </div>
        </section>
      )}

      {activeModule === "live" && (
        session.activeAppointment && session.status === "connected" ? (
          <LiveConsultationPanel
            role="patient"
            counterpartName={session.activeAppointment.doctor.name}
            appointmentTime={session.activeAppointment.scheduledAt}
            status={session.status}
            isCameraOn={session.isCameraOn}
            isMicOn={session.isMicOn}
            isScreenSharing={session.isScreenSharing}
            counterpartCameraOn={session.counterpartCameraOn}
            counterpartMicOn={session.counterpartMicOn}
            counterpartScreenSharing={session.counterpartScreenSharing}
            connectedAt={session.connectedAt}
            onToggleCamera={session.toggleCamera}
            onToggleMic={session.toggleMic}
            onToggleScreenShare={handleToggleScreenShare}
            onEnd={handleEndSession}
            localStream={webRTC.localStream}
            screenShareStream={webRTC.screenShareStream}
            remoteStream={webRTC.remoteStream}
            connectionState={webRTC.connectionState}
            mediaError={webRTC.error}
            screenShareSupported={webRTC.screenShareSupported}
            scheduledDurationMinutes={session.activeAppointment.duration || 30}
            onExtendCall={handleExtendCall}
            externalExtendedMinutes={callExtendedMinutes}
            devices={webRTC.devices}
            cameraDeviceId={webRTC.cameraDeviceId}
            microphoneDeviceId={webRTC.microphoneDeviceId}
            deviceStatus={webRTC.deviceStatus}
            onCameraDeviceChange={webRTC.setCameraDeviceId}
            onMicrophoneDeviceChange={webRTC.setMicrophoneDeviceId}
            onRefreshDevices={() => void webRTC.refreshDevices()}
            chat={<ChatPanel role="patient" messages={session.messages} onSend={session.sendMessage} />}
            documentation={
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs max-h-[calc(100vh-14rem)] overflow-y-auto space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-teal/15 text-brand-teal text-xs font-black">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Live Clinical Record</p>
                      <h3 className="text-sm font-black text-slate-900">Consultation Notes &amp; Rx</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Sync
                  </div>
                </div>

                {/* Section 1: Patient's Reported Reason & Complaint */}
                {(() => {
                  const parsed = extractComplaintAndNotes(currentLiveBooking?.reason || session.activeAppointment?.reason);
                  if (!parsed.complaint && !parsed.notes) return null;
                  return (
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                          Reported Reason for Visit
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-amber-950 leading-relaxed pl-3 border-l-2 border-amber-300">
                        {parsed.complaint}
                      </p>
                      {parsed.notes && (
                        <p className="text-[11px] text-amber-900/85 leading-relaxed pl-3 pt-0.5 border-l-2 border-amber-300 italic">
                          Patient notes: {parsed.notes}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Section 2: Doctor's Consultation Notes */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                    <div className="flex items-center gap-1.5">
                      <svg className="h-4 w-4 text-brand-teal shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-800">Doctor&apos;s Consultation Notes</p>
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                      Dr. {session.activeAppointment.doctor.name}
                    </span>
                  </div>

                  {activeConsultationNotes ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                        <p className="text-xs font-semibold text-slate-800 whitespace-pre-line leading-relaxed">
                          {activeConsultationNotes}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-1">
                        <span>Clinical Observations &amp; Advice</span>
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Saved by Doctor
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-3.5 text-center space-y-1">
                      <div className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-brand-teal/10 text-brand-teal">
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                        </svg>
                      </div>
                      <p className="text-xs font-bold text-slate-700">Doctor is documenting consultation notes</p>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed max-w-sm mx-auto">
                        Clinical observations, diagnosis, and care instructions entered by Dr. {session.activeAppointment.doctor.name} will display here in real time.
                      </p>
                    </div>
                  )}
                </div>

                {/* Section 3: Official E-Prescription (Rx) */}
                <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-teal-200/60 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="grid h-5 w-5 place-items-center rounded bg-brand-teal text-white text-[10px] font-black">
                        Rx
                      </span>
                      <p className="text-xs font-black uppercase tracking-wide text-teal-950">Official E-Prescription</p>
                    </div>
                    {activePrescription && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Prescribed
                      </span>
                    )}
                  </div>

                  {activePrescription ? (
                    <div className="space-y-2.5">
                      {(() => {
                        const hasMarkers = activePrescription.includes("--- Medicine ");
                        const blocks = hasMarkers
                          ? activePrescription.split(/(?=--- Medicine \d+ ---)/g).map((s) => s.trim()).filter(Boolean)
                          : [activePrescription];
                        const exceedsTwo = blocks.length > 2;

                        return (
                          <div className={exceedsTwo ? "max-h-[260px] overflow-y-auto space-y-2 pr-1.5" : "space-y-2"}>
                            {blocks.map((block, i) => (
                              <div key={i} className="rounded-lg border border-teal-100 bg-white p-3 shadow-2xs">
                                <pre className="text-xs font-mono font-medium text-slate-900 whitespace-pre-wrap leading-relaxed">
                                  {block}
                                </pre>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <p className="text-[10px] text-teal-800 font-medium pt-1">
                        ⚠️ Please follow all directions and confirm dosage with your pharmacist before taking medication. Your official PDF will be available in <strong>Medical Access → Records</strong> after the consultation.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-teal-200 bg-white/60 p-3 text-center">
                      <p className="text-xs font-bold text-teal-900">No Prescriptions Added Yet</p>
                      <p className="mt-0.5 text-[11px] font-medium text-teal-700/80">
                        When the doctor issues medication, the e-prescription and official downloadable PDF will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            }
          />
        ) : (
          <section className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Patient Consultation Dashboard</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Live Consultation Hub</h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
                    Track upcoming consultation access, live-room readiness, and post-consultation care without leaving the telehealth workflow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule("book")}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700"
                >
                  Manage Appointments
                </button>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[35fr_65fr]">
              <section className="rounded-xl border border-slate-200 bg-white">
                <header className="border-b border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">My Timeline</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">Consultation Access</h3>
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-100 p-1">
                    {CONSULTATION_TIMELINE_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setConsultationFilter(filter.id)}
                        className={`rounded-md px-3 py-2 text-[10px] font-black uppercase transition ${
                          consultationFilter === filter.id ? "bg-white text-brand-teal shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </header>

                <div className="max-h-[760px] space-y-3 overflow-y-auto p-4">
                  {consultationTimeline.length ? consultationTimeline.map((booking) => {
                    const isSelected = selectedAppointment?.id === booking.id;
                    const roomReady = Boolean(authorizedRooms[booking.id] || startedAppointmentId === booking.id);
                    const doctorProfile = doctors.find((doctor) => doctor.id === booking.doctor.id);
                    const initials = getInitials(booking.doctor.name) || "DR";

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedAppointmentId(booking.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
                          isSelected ? "border-brand-teal bg-brand-teal/5 shadow-sm shadow-brand-teal/10" : "border-slate-200 bg-white hover:border-brand-teal/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {doctorProfile?.image ? (
                            <Image src={doctorProfile.image} alt={booking.doctor.name} width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-xs font-black text-brand-teal">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-1.5">
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-sm leading-tight text-slate-950">{booking.doctor.name}</p>
                                <p className="mt-0.5 text-xs font-bold text-brand-teal">{booking.doctor.specialty}</p>
                              </div>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getAppointmentStatusStyle(booking.status)}`}>
                                {booking.status}
                              </span>
                            </div>
                            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                              <span>{formatAppointmentFeedDate(booking.scheduledAt)}</span>
                              <span>{formatAppointmentFeedTime(booking.scheduledAt)}</span>
                            </div>
                            {roomReady && <p className="mt-2 rounded-lg bg-brand-red px-2 py-1 text-center text-[10px] font-black uppercase text-white">● Join Room Ready</p>}
                          </div>
                        </div>
                      </button>
                    );
                  }) : (
                    <EmptyState title="No consultations match this view" body="Book an appointment or switch timeline tabs." />
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {selectedAppointment ? (
                  <div className="space-y-5 p-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Action Hub</p>
                          <h3 className="mt-1 text-xl font-black text-white">{selectedAppointment.status === "CONFIRMED" && (authorizedRooms[selectedAppointment.id] || startedAppointmentId === selectedAppointment.id) ? "Live Consultation Ready" : selectedAppointment.status === "CONFIRMED" ? "Waiting for Doctor" : selectedAppointment.status === "PENDING" ? "Awaiting Confirmation" : `${selectedAppointment.status.charAt(0)}${selectedAppointment.status.slice(1).toLowerCase()} Consultation`}</h3>
                          <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-300">
                            {selectedAppointment.status === "PENDING" && "Your appointment is in the clinical queue for doctor review."}
                            {selectedAppointment.status === "CONFIRMED" && (authorizedRooms[selectedAppointment.id] || startedAppointmentId === selectedAppointment.id) && "The secure WebRTC room has been opened for this consultation."}
                            {selectedAppointment.status === "CONFIRMED" && !(authorizedRooms[selectedAppointment.id] || startedAppointmentId === selectedAppointment.id) && "Your appointment is confirmed. The join button activates once the doctor starts the live room."}
                            {selectedAppointment.status === "COMPLETED" && "This consultation is closed. Review notes, prescriptions, and documents below."}
                            {selectedAppointment.status === "CANCELLED" && "This consultation was cancelled. You can book another appointment with your care team."}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:min-w-56">
                          {selectedAppointment.status === "PENDING" && isDoctorFollowUp(selectedAppointment) ? (
                            <>
                              <button
                                type="button"
                                disabled={followUpActionId === selectedAppointment.id}
                                onClick={() => void handleConfirmFollowUp(selectedAppointment)}
                                className="rounded-xl bg-brand-teal px-4 py-3 text-xs font-black text-white disabled:bg-slate-600"
                              >
                                Confirm Follow-Up
                              </button>
                              <button
                                type="button"
                                disabled={followUpActionId === selectedAppointment.id}
                                onClick={() => openFollowUpReschedule(selectedAppointment)}
                                className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-black text-white disabled:text-slate-400"
                              >
                                Request Reschedule
                              </button>
                            </>
                          ) : selectedAppointment.status === "CONFIRMED" ? (
                            <button
                              type="button"
                              onClick={() => startLiveSession(selectedAppointment)}
                              className={`rounded-xl px-4 py-3 text-xs font-black text-white ${authorizedRooms[selectedAppointment.id] || startedAppointmentId === selectedAppointment.id ? "bg-brand-red" : "bg-brand-teal"}`}
                            >
                              {joiningAppointmentId === selectedAppointment.id ? "Joining..." : authorizedRooms[selectedAppointment.id] || startedAppointmentId === selectedAppointment.id ? "Join Live Consultation" : "Waiting for Doctor"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActiveModule(selectedAppointment.status === "COMPLETED" ? "history" : "book")}
                              className="rounded-xl bg-white px-4 py-3 text-xs font-black text-slate-950 shadow-sm"
                            >
                              {selectedAppointment.status === "COMPLETED" ? "View Medical Record" : "Manage Appointment"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Appointment Information</p>
                        <dl className="mt-3.5 space-y-2.5 text-xs">
                          <div className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-2">
                            <dt className="font-bold text-slate-500">Doctor</dt>
                            <dd className="text-right font-black text-slate-950 break-words">{selectedAppointment.doctor.name}</dd>
                          </div>
                          <div className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-2">
                            <dt className="font-bold text-slate-500">Specialization</dt>
                            <dd className="text-right font-black text-slate-950 break-words">{selectedAppointment.doctor.specialty}</dd>
                          </div>
                          <div className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-2">
                            <dt className="font-bold text-slate-500">Date</dt>
                            <dd className="text-right font-black text-slate-950">{formatAppointmentFeedDate(selectedAppointment.scheduledAt)}</dd>
                          </div>
                          <div className="grid grid-cols-[100px_minmax(0,1fr)] items-start gap-2">
                            <dt className="font-bold text-slate-500">Time</dt>
                            <dd className="text-right font-black text-slate-950">{formatAppointmentFeedTime(selectedAppointment.scheduledAt)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                          {selectedAppointmentDoctor?.image ? (
                            <Image src={selectedAppointmentDoctor.image} alt={selectedAppointment.doctor.name} width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-sm font-black text-brand-teal">
                              {getInitials(selectedAppointment.doctor.name) || "DR"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Reason for Visit</p>
                            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">
                              {selectedAppointment.reason || "No reason was provided for this consultation."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white">
                      <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 p-3">
                        {CONSULTATION_HUB_TABS.map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setConsultationHubTab(tab.id)}
                            className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-black uppercase ${
                              consultationHubTab === tab.id ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <div className="p-4">
                        {consultationHubTab === "prescriptions" && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Prescription</p>
                            <div className={selectedAppointment.prescription && (selectedAppointment.prescription.match(/--- Medicine \d+ ---/g)?.length || 0) > 2 ? "mt-2 max-h-52 overflow-y-auto pr-1.5" : "mt-2"}>
                              <p className="text-sm font-semibold text-slate-700 whitespace-pre-line leading-relaxed">{selectedAppointment.prescription || "No prescription has been issued for this consultation yet."}</p>
                            </div>
                          </div>
                        )}
                        {consultationHubTab === "notes" && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Doctor&apos;s Notes</p>
                            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">{selectedAppointment.notes || "Doctor notes will appear here after clinical documentation is completed."}</p>
                          </div>
                        )}
                        {consultationHubTab === "documents" && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => downloadMedicalReport(selectedAppointment, patient)}
                              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-300 hover:bg-white"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                  <polyline points="10 9 9 9 8 9" />
                                </svg>
                              </span>
                              <div>
                                <p className="text-sm font-black text-slate-950">Consultation Report</p>
                                <p className="mt-0.5 text-[10px] font-semibold text-slate-500">Full clinical notes, assessment &amp; plan</p>
                              </div>
                            </button>
                            {selectedAppointment.prescription ? (
                              <button
                                type="button"
                                onClick={() => downloadMedicalReport(selectedAppointment, patient)}
                                className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-left transition hover:border-teal-300 hover:bg-teal-100/60"
                              >
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-teal text-white">
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                </span>
                                <div>
                                  <p className="text-sm font-black text-teal-900">Official E-Prescription PDF</p>
                                  <p className="mt-0.5 text-[10px] font-semibold text-teal-700">E-Signed · DOH / FDA compliant</p>
                                </div>
                              </button>
                            ) : (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-black text-slate-950">Medical Documents</p>
                                <p className="mt-2 text-xs font-semibold text-slate-500">Doctor-uploaded files and lab attachments will appear here when available.</p>
                              </div>
                            )}
                          </div>
                        )}
                        {consultationHubTab === "requirements" && (
                          <div className="grid gap-3 md:grid-cols-3">
                            {[
                              { label: "Identity", body: "Use your registered Healthko account." },
                              { label: "Device Check", body: "Camera, microphone, and internet ready before joining." },
                              { label: "Visit Context", body: selectedAppointment.reason ? "Reason for visit is recorded." : "Add context during the consultation." },
                            ].map((item) => (
                              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-black text-slate-950">{item.label}</p>
                                <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{item.body}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState title="No appointment selected" body="Choose an appointment from My Timeline to load the consultation action hub." />
                  </div>
                )}
              </section>
            </div>
          </section>
        )
      )}

      {activeModule === "history" && (
        <section className="grid min-h-[calc(100vh-9rem)] gap-5 xl:grid-cols-[35fr_65fr]">
          <aside className="min-h-0 rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Medical Access</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Consultation Timeline</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Select an encounter to review clinical documentation.</p>
            </header>
            <div className="max-h-[calc(100vh-15rem)] space-y-2 overflow-y-auto p-3">
              {medicalAccessAppointments.length ? medicalAccessAppointments.map((booking) => {
                const selected = selectedMedicalAppointment?.id === booking.id;

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => {
                      setSelectedMedicalAppointmentId(booking.id);
                      setMedicalAccessTab("summary");
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected ? "border-brand-teal bg-brand-teal/5" : "border-slate-200 bg-white hover:border-brand-teal/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{booking.doctor.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{formatAppointmentFeedDate(booking.scheduledAt)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getAppointmentStatusStyle(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  </button>
                );
              }) : (
                <EmptyState title="No medical records yet" body="Completed consultations and doctor documentation appear here." />
              )}
            </div>
          </aside>

          <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
            {selectedMedicalAppointment ? (
              <div className="flex h-full flex-col">
                <header className="border-b border-slate-200 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Encounter Detail</p>
                      <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedMedicalAppointment.doctor.name}</h2>
                      <p className="mt-1 text-sm font-bold text-slate-500">{selectedMedicalAppointment.doctor.specialty}</p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">{formatDateTime(selectedMedicalAppointment.scheduledAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadMedicalReport(selectedMedicalAppointment, patient)}
                      className="rounded-lg bg-slate-950 px-4 py-3 text-xs font-black text-white"
                    >
                      Download PDF Report
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {MEDICAL_ACCESS_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMedicalAccessTab(tab.id)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${
                          medicalAccessTab === tab.id ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </header>

                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                  {medicalAccessTab === "summary" && (
                    <section className="grid gap-3 md:grid-cols-4">
                      {[
                        { label: "Chief Complaint", value: selectedMedicalAppointment.reason || "No chief complaint recorded." },
                        { label: "Vitals", value: "Not recorded in this encounter." },
                        { label: "Duration", value: `${selectedMedicalAppointment.duration || DEFAULT_DURATION_MINUTES} minutes` },
                        { label: "Status", value: selectedMedicalAppointment.status },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                          <p className="mt-2 text-sm font-black leading-relaxed text-slate-800">{item.value}</p>
                        </div>
                      ))}
                    </section>
                  )}

                  {medicalAccessTab === "assessment" && (
                    <section className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Doctor Assessment And Plan</p>
                        <ul className="mt-4 space-y-3">
                          {(getMedicalBullets(selectedMedicalAppointment.notes).length ? getMedicalBullets(selectedMedicalAppointment.notes) : ["No doctor assessment has been documented for this encounter."]).map((item) => (
                            <li key={item} className="flex gap-3 rounded-lg bg-white p-3 text-sm font-bold text-slate-800">
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-teal" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-red">Emergency Precautions</p>
                        <p className="mt-2 text-sm font-bold leading-relaxed text-red-800">
                          Seek urgent medical care for severe symptoms, breathing difficulty, chest pain, sudden weakness, allergic reactions, or rapidly worsening condition.
                        </p>
                      </div>
                    </section>
                  )}

                  {medicalAccessTab === "prescriptions" && (
                    <section className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Official E-Prescription</p>
                          {selectedMedicalAppointment.prescription && (
                            <button
                              type="button"
                              onClick={() => downloadMedicalReport(selectedMedicalAppointment, patient)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-teal px-3 py-2 text-[10px] font-black text-white transition hover:bg-teal-600 active:scale-[0.98]"
                            >
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                              Download Rx PDF (E-Signed)
                            </button>
                          )}
                        </div>
                        <div className={`mt-4 rounded-xl border bg-white ${
                          selectedMedicalAppointment.prescription
                            ? "border-teal-100"
                            : "border-slate-200"
                        }`}>
                          {selectedMedicalAppointment.prescription ? (
                            <div className={"max-h-72 overflow-y-auto p-4"}>
                              <pre className="text-sm font-mono font-medium text-slate-900 whitespace-pre-wrap leading-relaxed">
                                {selectedMedicalAppointment.prescription}
                              </pre>
                            </div>
                          ) : (
                            <div className="p-5 text-center">
                              <p className="text-sm font-black text-slate-500">No prescription issued</p>
                              <p className="mt-1 text-xs font-semibold text-slate-400">No medication was prescribed during this consultation.</p>
                            </div>
                          )}
                        </div>
                        {selectedMedicalAppointment.prescription && (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Directions</p>
                              <p className="mt-2 text-xs font-semibold text-slate-700">
                                Follow the prescribing doctor&apos;s instructions and confirm dosage before taking medication.
                              </p>
                            </div>
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                              <p className="text-[10px] font-black uppercase tracking-wider text-brand-red">Warnings</p>
                              <p className="mt-2 text-xs font-semibold text-red-800">
                                Report allergies, side effects, pregnancy, or medication conflicts to your care team before use.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="No encounter selected" body="Choose a consultation record from the timeline." />
              </div>
            )}
          </section>
        </section>
      )}

      {activeModule === "prescriptions" && (
        <PrescriptionList
          role="patient"
          items={appointments.map((booking) => {
            const patAge = patient.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : "Adult";
            return {
              id: booking.id,
              prescription: booking.prescription,
              reason: booking.reason,
              scheduledAt: booking.scheduledAt,
              owner: booking.doctor.name,
              doctorName: booking.doctor.name,
              doctorSpecialty: booking.doctor.specialty,
              doctorLicense: booking.doctor.licenseNumber,
              doctorNpi: booking.doctor.npi,
              clinicName: `CLINIC OF DR. ${booking.doctor.name.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`,
              patientName: `${patient.firstName} ${patient.lastName}`,
              patientAge: patAge,
              patientGender: patient.gender,
              patientAddress: patient.address ? `${patient.address}, ${patient.city || ""}` : undefined,
            };
          })}
        />
      )}

      {activeModule === "doctors" && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => (
            <article key={doctor.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{doctor.name}</p>
                  <p className="mt-1 text-xs font-bold text-brand-teal">{doctor.specialty}</p>
                </div>
                {doctor.isVerified && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                    Verified
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">{doctor.availability}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setProfileDoctor(doctor)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
                  View Profile
                </button>
                {doctor.isVerified && (
                  <button type="button" onClick={() => { setSelectedDoctorId(doctor.id); setActiveModule("book"); setIsBookingOpen(true); }} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">
                    Book with Doctor
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {activeModule === "messages" && <ChatPanel role="patient" messages={session.messages} onSend={session.sendMessage} tone={tone} />}

      {activeModule === "notifications" && (
        <section className="space-y-3">
          {dashboardNotifications.notifications.length ? dashboardNotifications.notifications.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-950">{item.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{item.body}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{item.kind || "system"} / {formatDateTime(item.createdAt)}</p>
            </article>
          )) : <EmptyState title="No notifications" body="Appointment, consultation, and prescription alerts appear here." />}
        </section>
      )}

      {activeModule === "billing" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black">Payments & Billing</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">No outstanding patient balances. Payment records will attach to confirmed consultations.</p>
        </section>
      )}

      {activeModule === "settings" && (
        <PatientSettingsModule tone={tone} patient={patient} onToast={showToast} />
      )}
    </DashboardShell>
  );
}


