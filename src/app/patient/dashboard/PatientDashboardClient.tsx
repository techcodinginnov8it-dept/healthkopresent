"use client";

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { logoutPatient, checkSessionStatus } from "@/app/actions/auth";
import { bookAppointment, confirmFollowUpAppointment, requestFollowUpReschedule } from "@/app/actions/patient";
import { authorizePatientVideoSession, endVideoSession } from "@/app/actions/video-session";
import { saveConsultationTranscript } from "@/app/actions/doctor";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import {
  PatientSettingsModule,
  MedicalFilePreviewModal,
  INITIAL_PATIENT_MEDICAL_FILES,
  CATEGORY_CONFIG,
  formatDocDate,
  type PatientUploadedDocument,
} from "@/components/dashboard/SettingsModule";
import { downloadMedicalArchiveSamplePdf } from "@/lib/medical-archive-sample-pdf";
import { ConcurrentLoginModal } from "@/components/dashboard/ConcurrentLoginModal";
import { ActiveCallWarningModal } from "@/components/dashboard/ActiveCallWarningModal";
import { AppointmentCalendar, type CalendarViewMode, type CalendarAppointment } from "@/components/dashboard/AppointmentCalendar";
import { useActiveCallGuard } from "@/hooks/useActiveCallGuard";
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
import { formatDateTime, formatDate, formatTime, toLocalDateKey, toLocalTimeKey, toUtcIsoFromLocal } from "@/lib/dashboard/format";
import { downloadPrescriptionPdf, generatePrescriptionPdf } from "@/lib/prescription-pdf";
import { downloadConsultationTranscriptPdf, generateConsultationTranscriptPdf, parseNotesAndTranscript } from "@/lib/consultation-transcript-pdf";
import { downloadConsultationReportPdf, generateConsultationReportPdf } from "@/lib/consultation-report-pdf";
import { downloadMedicalCertificatePdf, generateMedicalCertificatePdf } from "@/lib/medical-certificate-pdf";
import { pdfStringToBytes } from "@/lib/pdf-download-helper";
import { createDashboardNotification } from "@/lib/dashboard/notifications";
import { DEFAULT_DURATION_MINUTES, getScheduleConflict, parseAvailability, isWithinDoctorAvailability, getOutsideAvailabilityMessage } from "@/lib/scheduling";
import type {
  DashboardNotification,
  DashboardDoctor,
  DashboardPatient,
  PatientAppointment,
  PatientModuleId,
  RealtimeEvent,
} from "@/lib/dashboard/types";

export type PatientMedicalCertificate = {
  id: string;
  certNumber: string;
  purpose: string;
  diagnosis: string | null;
  remarks: string | null;
  restDaysFrom: Date | string | null;
  restDaysTo: Date | string | null;
  issuedAt: Date | string;
  consultationId?: string | null;
  doctor: {
    id?: string;
    name: string;
    specialty: string;
    licenseNumber?: string | null;
    npi?: string | null;
  };
};

type Patient = DashboardPatient & {
  createdAt: Date;
  bookings: PatientAppointment[];
  medicalCertificates?: PatientMedicalCertificate[];
};

type PatientDashboardClientProps = {
  patient: Patient;
  doctors: DashboardDoctor[];
  initialModule?: PatientModuleId;
  medicalIdUrl: string;
  currentSessionId?: string;
};

type AppointmentFeedFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled";
type MedicalAccessTab = "summary" | "assessment" | "prescriptions" | "certificates" | "transcript";
type ConsultationTimelineFilter = "all" | "upcoming" | "past";
type ConsultationHubTab = "prescriptions" | "certificates" | "notes" | "documents" | "requirements";

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
  { id: "certificates", label: "Medical Certificate" },
  { id: "transcript", label: "Transcript" },
];

const CONSULTATION_TIMELINE_FILTERS: { id: ConsultationTimelineFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

const CONSULTATION_HUB_TABS: { id: ConsultationHubTab; label: string }[] = [
  { id: "prescriptions", label: "Prescriptions" },
  { id: "certificates", label: "Medical Certificate" },
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
  return toLocalDateKey(date);
}

function toTimeValue(date: Date) {
  return toLocalTimeKey(date);
}

function formatAppointmentFeedDate(value: Date | string) {
  return formatDate(value);
}

function formatAppointmentFeedTime(value: Date | string) {
  return formatTime(value);
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
}function downloadFullConsultationReport(appointment: PatientAppointment, patient?: DashboardPatient) {
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Patient";
  const patientAge = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "Adult";

  const { clinicalNotes: cleanNotes } = parseNotesAndTranscript(appointment.notes);

  downloadConsultationReportPdf({
    doctorName: appointment.doctor.name,
    doctorSpecialty: appointment.doctor.specialty,
    doctorLicense: appointment.doctor.licenseNumber,
    doctorNpi: appointment.doctor.npi,
    clinicName: `CLINIC OF DR. ${appointment.doctor.name.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`,
    patientName,
    patientAge,
    patientDob: patient?.dob ? String(patient.dob).slice(0, 10) : undefined,
    patientGender: patient?.gender,
    patientAddress: patient?.address ? `${patient.address}, ${patient.city || ""}` : undefined,
    patientPhone: patient?.phone || undefined,
    bloodPressure: appointment.bloodPressure || "120/80",
    heartRate: appointment.heartRate ? `${appointment.heartRate}` : "72",
    bodyTemperature: appointment.bodyTemperature ? `${appointment.bodyTemperature}` : "36.6",
    oxygenSaturation: "98%",
    weight: patient?.weight ? `${patient.weight} kg` : undefined,
    height: patient?.height ? `${patient.height} cm` : undefined,
    appointmentId: appointment.id,
    date: appointment.scheduledAt,
    durationMinutes: appointment.duration || DEFAULT_DURATION_MINUTES,
    reasonForVisit: appointment.reason || "Telehealth Consultation",
    chiefComplaint: appointment.reason || "General medical consultation and clinical evaluation",
    clinicalAssessment: cleanNotes || appointment.notes || "Clinical consultation and assessment completed via synchronous telehealth.",
    diagnosis: appointment.reason || "Telehealth Clinical Encounter",
    carePlan: appointment.prescription
      ? `Electronic prescription issued. Adhere strictly to dosage regimen and follow-up guidance.`
      : (cleanNotes || "Continue supportive measures and monitor symptoms as discussed."),
    prescriptionSummary: appointment.prescription || "No prescription issued for this encounter.",
    followUpDate: "As clinically indicated / In 2 to 4 weeks",
    monitoringInstructions: "If acute chest pain, shortness of breath, or severe symptoms occur, proceed to emergency medical care.",
  });
}


function downloadTranscriptReport(appointment: PatientAppointment, patient?: DashboardPatient) {
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Patient";
  const patientAge = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "Adult";

  const { clinicalNotes: cleanNotes, transcriptTurns: parsedTurns } = parseNotesAndTranscript(appointment.notes);
  let customTranscript: any = parsedTurns.length > 0 ? parsedTurns : undefined;

  if (!customTranscript && typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(`healthko:transcript:${appointment.id}`);
      if (saved) customTranscript = JSON.parse(saved);
    } catch {}
  }

  downloadConsultationTranscriptPdf({
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
    durationMinutes: appointment.duration || DEFAULT_DURATION_MINUTES,
    reasonForVisit: appointment.reason || "Telehealth Consultation",
    clinicalAssessment: cleanNotes || appointment.notes || "Clinical consultation and assessment completed via synchronous telehealth.",
    clinicalPlan: appointment.prescription
      ? `Electronic prescription issued:\n${appointment.prescription}`
      : "Follow doctor advice and schedule follow-up as instructed.",
    transcript: customTranscript,
  });
}

function previewTranscriptReport(
  appointment: PatientAppointment,
  patient?: DashboardPatient,
  onOpenPreview?: (doc: PatientUploadedDocument) => void
) {
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Patient";
  const patientAge = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "Adult";

  const { clinicalNotes: cleanNotes, transcriptTurns: parsedTurns } = parseNotesAndTranscript(appointment.notes);
  let customTranscript: any = parsedTurns.length > 0 ? parsedTurns : undefined;

  if (!customTranscript && typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(`healthko:transcript:${appointment.id}`);
      if (saved) customTranscript = JSON.parse(saved);
    } catch {}
  }

  const pdfStr = generateConsultationTranscriptPdf({
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
    durationMinutes: appointment.duration || DEFAULT_DURATION_MINUTES,
    reasonForVisit: appointment.reason || "Telehealth Consultation",
    clinicalAssessment: cleanNotes || appointment.notes || "Clinical consultation and assessment completed via synchronous telehealth.",
    clinicalPlan: appointment.prescription
      ? `Electronic prescription issued:\n${appointment.prescription}`
      : "Follow doctor advice and schedule follow-up as instructed.",
    transcript: customTranscript,
  });

  const blob = new Blob([pdfStringToBytes(pdfStr)], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  onOpenPreview?.({
    id: `transcript-${appointment.id}`,
    title: `Encounter Transcript - Dr. ${appointment.doctor.name}`,
    category: "other",
    fileName: `Call_Transcript_${appointment.id.slice(-6).toUpperCase()}.pdf`,
    fileSize: "135 KB",
    fileType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    doctorOrClinic: appointment.doctor.name,
    consultationDate: typeof appointment.scheduledAt === "string" ? appointment.scheduledAt : appointment.scheduledAt.toISOString(),
    notes: "Official audio/video consultation dialogue transcript.",
    fileData: blobUrl,
  });
}

function downloadPatientCertPdf(
  cert: PatientMedicalCertificate,
  patient?: DashboardPatient
) {
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Patient";
  const patientAge = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "Adult";

  downloadMedicalCertificatePdf({
    certNumber: cert.certNumber,
    doctorName: cert.doctor.name,
    doctorSpecialty: cert.doctor.specialty,
    doctorLicense: cert.doctor.licenseNumber,
    doctorNpi: cert.doctor.npi,
    patientName,
    patientAge,
    patientGender: patient?.gender,
    patientAddress: patient?.address ? `${patient.address}, ${patient.city || ""}` : undefined,
    purpose: cert.purpose as "sick_leave" | "fitness_to_work" | "school" | "other",
    diagnosis: cert.diagnosis,
    remarks: cert.remarks,
    restDaysFrom: cert.restDaysFrom,
    restDaysTo: cert.restDaysTo,
    issuedAt: cert.issuedAt,
  });
}

function previewFullConsultationReport(
  appointment: PatientAppointment,
  patient?: DashboardPatient,
  onOpenPreview?: (doc: PatientUploadedDocument) => void
) {
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Patient";
  const patientAge = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "Adult";

  const { clinicalNotes: cleanNotes } = parseNotesAndTranscript(appointment.notes);

  const reportData = {
    doctorName: appointment.doctor.name,
    doctorSpecialty: appointment.doctor.specialty,
    doctorLicense: appointment.doctor.licenseNumber,
    doctorNpi: appointment.doctor.npi,
    clinicName: `CLINIC OF DR. ${appointment.doctor.name.toUpperCase().replace(/^DR\.?\s+/i, "")}, MD`,
    patientName,
    patientAge,
    patientDob: patient?.dob ? String(patient.dob).slice(0, 10) : undefined,
    patientGender: patient?.gender,
    patientAddress: patient?.address ? `${patient.address}, ${patient.city || ""}` : undefined,
    patientPhone: patient?.phone || undefined,
    bloodPressure: appointment.bloodPressure || "120/80",
    heartRate: appointment.heartRate ? `${appointment.heartRate}` : "72",
    bodyTemperature: appointment.bodyTemperature ? `${appointment.bodyTemperature}` : "36.6",
    oxygenSaturation: "98%",
    weight: patient?.weight ? `${patient.weight} kg` : undefined,
    height: patient?.height ? `${patient.height} cm` : undefined,
    appointmentId: appointment.id,
    date: appointment.scheduledAt,
    durationMinutes: appointment.duration || DEFAULT_DURATION_MINUTES,
    reasonForVisit: appointment.reason || "Telehealth Consultation",
    chiefComplaint: appointment.reason || "General medical consultation and clinical evaluation",
    clinicalAssessment: cleanNotes || appointment.notes || "Clinical consultation and assessment completed via synchronous telehealth.",
    diagnosis: appointment.reason || "Telehealth Clinical Encounter",
    carePlan: appointment.prescription
      ? `Electronic prescription issued. Adhere strictly to dosage regimen and follow-up guidance.`
      : (cleanNotes || "Continue supportive measures and monitor symptoms as discussed."),
    prescriptionSummary: appointment.prescription || "No prescription issued for this encounter.",
    followUpDate: "As clinically indicated / In 2 to 4 weeks",
    monitoringInstructions: "If acute chest pain, shortness of breath, or severe symptoms occur, proceed to emergency medical care.",
  };

  const pdfStr = generateConsultationReportPdf(reportData);
  const blob = new Blob([pdfStringToBytes(pdfStr)], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  onOpenPreview?.({
    id: `rpt-${appointment.id}`,
    title: `Consultation Report - Encounter #${appointment.id.slice(-6).toUpperCase()}`,
    category: "other",
    fileName: `Consultation_Report_${appointment.id.slice(-6).toUpperCase()}.pdf`,
    fileSize: "145 KB",
    fileType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    doctorOrClinic: appointment.doctor.name,
    consultationDate: typeof appointment.scheduledAt === "string" ? appointment.scheduledAt : appointment.scheduledAt.toISOString(),
    notes: cleanNotes || appointment.notes || appointment.reason || "Official clinical consultation encounter report.",
    fileData: blobUrl,
  });
}

function previewPatientCertPdf(
  cert: PatientMedicalCertificate,
  patient?: DashboardPatient,
  onOpenPreview?: (doc: PatientUploadedDocument) => void
) {
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Patient";
  const patientAge = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "Adult";

  const certData = {
    certNumber: cert.certNumber,
    doctorName: cert.doctor.name,
    doctorSpecialty: cert.doctor.specialty,
    doctorLicense: cert.doctor.licenseNumber,
    doctorNpi: cert.doctor.npi,
    patientName,
    patientAge,
    patientGender: patient?.gender,
    patientAddress: patient?.address ? `${patient.address}, ${patient.city || ""}` : undefined,
    purpose: cert.purpose as "sick_leave" | "fitness_to_work" | "school" | "other",
    diagnosis: cert.diagnosis,
    remarks: cert.remarks,
    restDaysFrom: cert.restDaysFrom,
    restDaysTo: cert.restDaysTo,
    issuedAt: cert.issuedAt,
  };

  const pdfStr = generateMedicalCertificatePdf(certData);
  const blob = new Blob([pdfStringToBytes(pdfStr)], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  const purposeTitle =
    cert.purpose === "sick_leave"
      ? "Sick Leave Certificate"
      : cert.purpose === "fitness_to_work"
      ? "Fitness to Work Clearance"
      : cert.purpose === "school"
      ? "Academic Clearance"
      : "Medical Certificate";

  onOpenPreview?.({
    id: `cert-${cert.id}`,
    title: `Official Medical Certificate (#${cert.certNumber})`,
    category: "certificate",
    fileName: `Medical_Certificate_${cert.certNumber}.pdf`,
    fileSize: "118 KB",
    fileType: "application/pdf",
    uploadedAt: typeof cert.issuedAt === "string" ? cert.issuedAt : cert.issuedAt.toISOString(),
    doctorOrClinic: cert.doctor.name,
    consultationDate: typeof cert.issuedAt === "string" ? cert.issuedAt : cert.issuedAt.toISOString(),
    notes: `${purposeTitle}${cert.diagnosis ? ` · Diagnosis: ${cert.diagnosis}` : ""}${cert.remarks ? ` · ${cert.remarks}` : ""}`,
    fileData: blobUrl,
  });
}

function previewMedicalReport(
  appointment: PatientAppointment,
  patient?: DashboardPatient,
  onOpenPreview?: (doc: PatientUploadedDocument) => void
) {
  const patientName = patient ? `${patient.firstName} ${patient.lastName}`.trim() : "Patient";
  const patientAge = patient?.dob
    ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))
    : "Adult";

  const rxData = {
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
  };

  const pdfStr = generatePrescriptionPdf(rxData);
  const blob = new Blob([pdfStringToBytes(pdfStr)], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  onOpenPreview?.({
    id: `rx-${appointment.id}`,
    title: `Digital Prescription - Dr. ${appointment.doctor.name}`,
    category: "prescription",
    fileName: `Prescription_${appointment.id.slice(-6).toUpperCase()}.pdf`,
    fileSize: "112 KB",
    fileType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    doctorOrClinic: appointment.doctor.name,
    consultationDate: typeof appointment.scheduledAt === "string" ? appointment.scheduledAt : appointment.scheduledAt.toISOString(),
    notes: appointment.prescription || "Digital electronic prescription order.",
    fileData: blobUrl,
  });
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
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

function getDoctorAvailableTimeSlots(doctor?: DashboardDoctor, dateStr?: string): { time: string; label: string }[] {
  if (!doctor || !dateStr) return [];
  const parsed = parseAvailability(doctor.availability);

  // parse "YYYY-MM-DD"
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return [];
  const [y, m, d] = parts;
  const dayDate = new Date(y, m - 1, d);
  if (Number.isNaN(dayDate.getTime())) return [];
  const dayOfWeek = dayDate.getDay();

  if (parsed && !parsed.days.includes(dayOfWeek)) {
    return [];
  }

  const startMinutes = parsed ? parsed.startMinutes : 9 * 60;
  const endMinutes = parsed ? parsed.endMinutes : 17 * 60;
  const duration = doctor.consultationDuration || DEFAULT_DURATION_MINUTES;

  const slots: { time: string; label: string }[] = [];
  for (let mins = startMinutes; mins + duration <= endMinutes; mins += duration) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hh = h.toString().padStart(2, "0");
    const mm = m.toString().padStart(2, "0");
    const timeValue = `${hh}:${mm}`;
    const ampm = h >= 12 ? "PM" : "AM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const label = `${displayH}:${mm} ${ampm}`;
    slots.push({ time: timeValue, label });
  }

  return slots;
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

export interface PetProfile {
  name: string;
  species: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  microchipId: string;
  vaccinationStatus: string;
  lastVaccinationDate: string;
  rabiesTagNumber: string;
  primaryVet: string;
  clinicName: string;
  clinicPhone: string;
  allergies: string;
  dietNotes: string;
}

const DEFAULT_PET_PROFILE: PetProfile = {
  name: "Milo",
  species: "Canine",
  breed: "Golden Retriever",
  age: "3 years old",
  gender: "Male (Neutered)",
  weight: "28.5 kg",
  microchipId: "PH-9851-4100-4829",
  vaccinationStatus: "Up to Date (Annual)",
  lastVaccinationDate: "August 14, 2026",
  rabiesTagNumber: "RAB-2026-08821",
  primaryVet: "Dr. Karen Santos, DVM",
  clinicName: "MetroVet Companion Animal Hospital",
  clinicPhone: "+63 (2) 8876-5432",
  allergies: "Beef protein sensitivity, Flea bite hypersensitivity",
  dietNotes: "High-protein dry kibble, sensitive digestion",
};

function EditPetModal({
  pet,
  onSave,
  onClose,
}: {
  pet: PetProfile;
  onSave: (updated: PetProfile) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PetProfile>(pet);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="edit-pet-title">
      <section className="my-8 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700 border border-teal-200">
              <span className="text-2xl">🐾</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Pet Health Record</p>
              <h2 id="edit-pet-title" className="text-xl font-black text-slate-950">Update Pet Details</h2>
              <p className="text-xs font-semibold text-slate-500">Edit companion profile, veterinary care, and health credentials.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50"
            aria-label="Close edit pet modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Pet Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Species</label>
              <input
                type="text"
                value={form.species}
                onChange={(e) => setForm({ ...form, species: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Breed</label>
              <input
                type="text"
                value={form.breed}
                onChange={(e) => setForm({ ...form, breed: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Age / Demographics</label>
              <input
                type="text"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Gender / Neutered Status</label>
              <input
                type="text"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Weight</label>
              <input
                type="text"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Microchip ID</label>
              <input
                type="text"
                value={form.microchipId}
                onChange={(e) => setForm({ ...form, microchipId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Vaccination Status</label>
              <input
                type="text"
                value={form.vaccinationStatus}
                onChange={(e) => setForm({ ...form, vaccinationStatus: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Last Vaccination Date</label>
              <input
                type="text"
                value={form.lastVaccinationDate}
                onChange={(e) => setForm({ ...form, lastVaccinationDate: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Rabies Tag Number</label>
              <input
                type="text"
                value={form.rabiesTagNumber}
                onChange={(e) => setForm({ ...form, rabiesTagNumber: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Primary Veterinarian</label>
              <input
                type="text"
                value={form.primaryVet}
                onChange={(e) => setForm({ ...form, primaryVet: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Veterinary Clinic</label>
              <input
                type="text"
                value={form.clinicName}
                onChange={(e) => setForm({ ...form, clinicName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Clinic Phone</label>
              <input
                type="text"
                value={form.clinicPhone}
                onChange={(e) => setForm({ ...form, clinicPhone: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">Allergies & Sensitivities</label>
              <input
                type="text"
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">Diet & Nutrition Notes</label>
            <textarea
              rows={2}
              value={form.dietNotes}
              onChange={(e) => setForm({ ...form, dietNotes: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-black text-white hover:bg-brand-teal-hover shadow-xs active:scale-[0.98]"
            >
              Save Pet Details
            </button>
          </div>
        </form>
      </section>
    </div>
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
              <div className="mt-1 flex items-center gap-2 min-w-0">
                <h2 id="doctor-profile-title" className="text-2xl font-black text-slate-950 truncate">{doctor.name}</h2>
                {doctor.isVerified && (
                  <span title="Verified Doctor" className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-brand-teal">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                      <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">{doctor.specialty}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50" aria-label="Close doctor profile">
            X
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          {[
            {
              label: "Verification",
              value: doctor.isVerified ? "Verified Practitioner" : "Pending verification",
              isVerified: doctor.isVerified,
            },
            { label: "License", value: doctor.licenseNumber ? `${doctor.licenseNumber}${doctor.licenseState ? ` / ${doctor.licenseState}` : ""}` : "Not provided" },
            { label: "Experience", value: doctor.yearsExp ? `${doctor.yearsExp} years` : "Not provided" },
            { label: "Availability", value: doctor.availability || "Available by appointment" },
            { label: "NPI", value: doctor.npi || "Not provided" },
            { label: "Consult Fee", value: formatPhilippinePeso(doctor.consultFee) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {item.isVerified && (
                  <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-brand-teal">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                      <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                <p className="text-sm font-black text-slate-800">{item.value}</p>
              </div>
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

export default function PatientDashboardClient({
  patient,
  doctors,
  initialModule = "overview",
  medicalIdUrl,
  currentSessionId,
}: PatientDashboardClientProps) {
  const router = useRouter();
  const [concurrentSession, setConcurrentSession] = useState<{
    isOpen: boolean;
    newDevice?: string;
    loginTime?: string;
  }>({ isOpen: false });

  useEffect(() => {
    if (!currentSessionId) return;

    const verifySession = async () => {
      try {
        const res = await checkSessionStatus("patient", currentSessionId);
        if (!res.valid) {
          setConcurrentSession({
            isOpen: true,
            newDevice: res.currentDevice || "Another Device",
            loginTime: res.lastLoginAt || new Date().toISOString(),
          });
        }
      } catch {}
    };

    const handleFocus = () => {
      void verifySession();
    };

    window.addEventListener("focus", handleFocus);
    const interval = window.setInterval(verifySession, 20000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
    };
  }, [currentSessionId]);

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
  const [medicalRecordModalAppointment, setMedicalRecordModalAppointment] = useState<PatientAppointment | null>(null);
  const [manageAppointmentsOpen, setManageAppointmentsOpen] = useState(false);
  const [manageApptSelected, setManageApptSelected] = useState<PatientAppointment | null>(null);
  const [manageApptAction, setManageApptAction] = useState<"idle" | "cancel" | "reschedule" | "reschedule-sent">("idle");
  const [manageApptReschedDate, setManageApptReschedDate] = useState("");
  const [manageApptReschedTime, setManageApptReschedTime] = useState("");
  const [medicalAccessTab, setMedicalAccessTab] = useState<MedicalAccessTab>("summary");
  const [rxSectionTab, setRxSectionTab] = useState<"prescriptions" | "certificates">("prescriptions");
  const [followUpActionId, setFollowUpActionId] = useState("");
  const [rescheduleAppointment, setRescheduleAppointment] = useState<PatientAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [appointmentCalendarAnchor, setAppointmentCalendarAnchor] = useState(() => startOfMonth(new Date()));
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("week");
  const [calendarAnchorDate, setCalendarAnchorDate] = useState<Date>(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [appointmentReferenceTime] = useState(() => new Date());
  const [medicalIdQrSvg, setMedicalIdQrSvg] = useState("");
  const [medicalIdAction, setMedicalIdAction] = useState<"idle" | "copied" | "downloaded">("idle");
  const [petProfile, setPetProfile] = useState<PetProfile>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`healthko:patient:${patient.id}:pet_profile`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_PET_PROFILE;
  });
  const [isEditingPet, setIsEditingPet] = useState(false);
  const [petQrSvg, setPetQrSvg] = useState("");
  const [qrViewMode, setQrViewMode] = useState<"patient" | "pet">("patient");
  const [petQrAction, setPetQrAction] = useState<"idle" | "copied" | "downloaded">("idle");
  const [bookingState, setBookingState] = useState<{ loading: boolean; error: string; success: string }>({
    loading: false,
    error: "",
    success: "",
  });
  const [toasts, setToasts] = useState<{ id: string; tone: "success" | "error"; message: string }[]>([]);
  const [liveConsultationNotes, setLiveConsultationNotes] = useState<string | null>(null);
  const [livePrescription, setLivePrescription] = useState<string | null>(null);
  const [callExtendedMinutes, setCallExtendedMinutes] = useState(0);
  const [medicalDocuments, setMedicalDocuments] = useState<PatientUploadedDocument[]>([]);
  const [previewMedicalDoc, setPreviewMedicalDoc] = useState<PatientUploadedDocument | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storageKey = `healthko:patient-uploaded-documents:${patient.id}`;
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed: PatientUploadedDocument[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((d) => d.id));
          const missingSeeds = INITIAL_PATIENT_MEDICAL_FILES.filter((s) => !existingIds.has(s.id));
          const merged = [...parsed, ...missingSeeds];
          setMedicalDocuments(merged);
          if (missingSeeds.length > 0) {
            window.localStorage.setItem(storageKey, JSON.stringify(merged));
          }
          return;
        }
      }
      setMedicalDocuments(INITIAL_PATIENT_MEDICAL_FILES);
      window.localStorage.setItem(storageKey, JSON.stringify(INITIAL_PATIENT_MEDICAL_FILES));
    } catch {
      setMedicalDocuments(INITIAL_PATIENT_MEDICAL_FILES);
    }
  }, [patient.id]);

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

  useEffect(() => {
    let active = true;
    const petQrData = `healthko://pet/${petProfile.microchipId}?name=${encodeURIComponent(petProfile.name)}&species=${encodeURIComponent(petProfile.species)}&breed=${encodeURIComponent(petProfile.breed)}&owner=${encodeURIComponent(`${patient.firstName} ${patient.lastName}`)}&phone=${encodeURIComponent(patient.phone || "")}&vet=${encodeURIComponent(petProfile.primaryVet)}`;

    QRCode.toString(petQrData, {
      errorCorrectionLevel: "M",
      margin: 1,
      type: "svg",
      width: 256,
    })
      .then((svg) => {
        if (active) {
          setPetQrSvg(svg);
        }
      })
      .catch((error) => {
        console.error("Failed to generate pet QR code:", error);
        if (active) {
          setPetQrSvg("");
        }
      });

    return () => {
      active = false;
    };
  }, [patient.firstName, patient.lastName, patient.phone, petProfile]);

  // Ref holding the set of this patient's appointmentIds â€” used inside the
  // Keep ref of bookings and appointment IDs accessible in socket event callbacks
  const patientAppointmentIdsRef = React.useRef<Set<string>>(new Set());
  const patientBookingsRef = React.useRef(patient.bookings);
  patientBookingsRef.current = patient.bookings;

  const onRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (
      event.type === "auth:concurrent-login" &&
      event.targetRole === "patient" &&
      event.targetUserId === patient.id &&
      currentSessionId &&
      event.newSessionId !== currentSessionId
    ) {
      setConcurrentSession({
        isOpen: true,
        newDevice: event.device,
        loginTime: event.timestamp,
      });
      return;
    }

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
  }, [currentSessionId, dismissedStartedId, patient.id, router, showToast]);

  const realtime = useDashboardRealtime(onRealtimeEvent);
  const session = useConsultationSession<PatientAppointment>({
    role: "patient",
    publish: realtime.publish,
    persistKey: `healthko:patient:${patient.id}:active-consultation`,
  });
  const isLiveConsultationActive = Boolean(session.roomId && (session.status === "waiting" || session.status === "connected"));
  const { showWarningModal, closeWarningModal } = useActiveCallGuard({
    isCallActive: isLiveConsultationActive,
    onEndCall: () => {
      session.endSession(true);
      setActiveModule("overview");
    },
  });

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
    onCounterpartScreenShareChange: (isSharing: boolean) => {
      session.setCounterpartScreenSharing(isSharing);
    },
  });
  const receiveRealtimeEvent = session.receiveRealtimeEvent;
  const handleToggleScreenShare = useCallback(async () => {
    if (webRTC.isScreenSharing || session.isScreenSharing || session.counterpartScreenSharing) {
      if (webRTC.isScreenSharing) {
        await webRTC.stopScreenShare();
      }
      session.setScreenSharing(false);
      session.setCounterpartScreenSharing(false);
      return;
    }

    const started = await webRTC.startScreenShare();
    if (started) {
      session.setScreenSharing(true);
    }
  }, [session, webRTC.isScreenSharing, webRTC.startScreenShare, webRTC.stopScreenShare]);

  const handleDismissPresentation = useCallback(async () => {
    if (webRTC.isScreenSharing) {
      await webRTC.stopScreenShare();
    }
    session.setScreenSharing(false);
    session.setCounterpartScreenSharing(false);
  }, [session, webRTC]);

  // Synchronize consultation session state when screen sharing is stopped via browser UI controls
  useEffect(() => {
    if (!webRTC.isScreenSharing && session.isScreenSharing) {
      session.setScreenSharing(false);
    }
  }, [webRTC.isScreenSharing, session.isScreenSharing, session.setScreenSharing]);

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

  const handleCopyPetPassLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`https://healthko.com/pet-pass/${petProfile.microchipId}`);
      setPetQrAction("copied");
      showToast("success", "Pet pass link copied to clipboard.");
      window.setTimeout(() => setPetQrAction("idle"), 2000);
    } catch {
      showToast("error", "Could not copy pet pass link.");
    }
  }, [petProfile.microchipId, showToast]);

  const handleDownloadPetQr = useCallback(() => {
    if (!petQrSvg) {
      showToast("error", "Pet QR code is still generating.");
      return;
    }
    downloadSvgAsFile(petQrSvg, `healthko-pet-pass-${petProfile.name.toLowerCase()}-${petProfile.microchipId}.svg`);
    setPetQrAction("downloaded");
    showToast("success", "Pet QR pass downloaded.");
    window.setTimeout(() => setPetQrAction("idle"), 2000);
  }, [petProfile.microchipId, petProfile.name, petQrSvg, showToast]);

  const handleSavePetProfile = useCallback((updated: PetProfile) => {
    setPetProfile(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`healthko:patient:${patient.id}:pet_profile`, JSON.stringify(updated));
      } catch {}
    }
    showToast("success", "Pet details updated successfully.");
    setIsEditingPet(false);
  }, [patient.id, showToast]);

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
    () =>
      [...appointments]
        .filter((booking) => booking.prescription)
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
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

    // Latest appointment first
    return [...dateFiltered].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
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

      // For upcoming: soonest first; for all or past: latest first
      return consultationFilter === "upcoming" ? first - second : second - first;
    });
  }, [appointmentReferenceTime, appointments, consultationFilter]);
  const medicalAccessAppointments = useMemo(
    () => [...appointments].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [appointments]
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
  const availableDoctorTimeSlots = useMemo(
    () => getDoctorAvailableTimeSlots(selectedDoctor, appointmentDate),
    [selectedDoctor, appointmentDate]
  );
  const calendarAppointments = useMemo<CalendarAppointment[]>(() => {
    return appointments.map((booking) => ({
      id: booking.id,
      title: booking.doctor.name,
      subtitle: booking.doctor.specialty || booking.reason || "Consultation",
      scheduledAt: booking.scheduledAt,
      status: booking.status,
      reason: booking.reason,
      duration: booking.duration,
      notes: booking.notes,
    }));
  }, [appointments]);
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
  const requestedDateTime = appointmentDate && appointmentTime ? new Date(toUtcIsoFromLocal(appointmentDate, appointmentTime)) : null;
  const patientConflict = requestedDateTime && !Number.isNaN(requestedDateTime.getTime())
    ? hasPatientScheduleConflict(appointments, requestedDateTime)
    : false;
  const isDoctorAvailableForSlot = requestedDateTime && !Number.isNaN(requestedDateTime.getTime()) && selectedDoctor
    ? isWithinDoctorAvailability(requestedDateTime, DEFAULT_DURATION_MINUTES, { availability: selectedDoctor.availability })
    : true;
  const notificationSeed = useMemo<DashboardNotification[]>(
    () => [
      ...[...patient.bookings]
        .filter((b) => b.status === "CANCELLED" && b.notes?.toLowerCase().includes("no show"))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
    { id: "book", label: "Consultation Appointments" },
    { id: "live", label: "Online Consultation", badge: confirmedAppointments.length || undefined },
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

    if (!isDoctorAvailableForSlot) {
      showToast("error", getOutsideAvailabilityMessage(selectedDoctor?.availability));
      setBookingState({ loading: false, error: "", success: "" });
      return;
    }

    setBookingState({ loading: true, error: "", success: "" });
    const combinedReason = patientNotes.trim()
      ? `${reason.trim()}\n\nPatient Notes: ${patientNotes.trim()}`
      : reason.trim();

    const isoScheduledAt = toUtcIsoFromLocal(appointmentDate, appointmentTime);

    const result = await bookAppointment({
      doctorId: selectedDoctorId,
      scheduledAt: isoScheduledAt,
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
      scheduledAt: isoScheduledAt,
      title: "New Booking Request",
      body: `A patient submitted a consultation request. Scheduled: ${isoScheduledAt ? new Date(isoScheduledAt).toLocaleString() : "TBD"}`,
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

  const [showEndCallConfirm, setShowEndCallConfirm] = useState(false);
  const [isEndCallLoading, setIsEndCallLoading] = useState(false);

  const handleEndSession = async () => {
    const roomId = session.roomId;
    if (session.activeAppointment) {
      const turnsToSave = session.transcriptTurns && session.transcriptTurns.length > 0 ? session.transcriptTurns : [];
      if (turnsToSave.length > 0) {
        try {
          await saveConsultationTranscript({
            consultationId: session.activeAppointment.id,
            turns: turnsToSave,
          });
        } catch {}
      }
      await endVideoSession(session.activeAppointment.id);
    }
    if (roomId) {
      realtime.endVideoRoom(roomId);
    }
    session.endSession();
    setStartedAppointmentId("");
    setJoiningAppointmentId("");
    setBlockedAppointment(null);
    setShowEndCallConfirm(false);
    setActiveModule("overview");
    router.refresh();
  };

  const handleRequestEndSession = () => {
    setShowEndCallConfirm(true);
  };

  const handleConfirmEndSession = async () => {
    setIsEndCallLoading(true);
    try {
      await handleEndSession();
    } finally {
      setIsEndCallLoading(false);
      setShowEndCallConfirm(false);
    }
  };

  const tone = "light" as const;
  const startedAppointment = startedAppointmentId
    ? appointments.find((booking) => booking.id === startedAppointmentId)
    : undefined;
  const sortedAppointmentsDesc = useMemo(
    () => [...appointments].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [appointments]
  );
  const completedAppointments = useMemo(
    () => sortedAppointmentsDesc.filter((booking) => booking.status === "COMPLETED"),
    [sortedAppointmentsDesc]
  );
  const recentDoctorNames = Array.from(new Set(sortedAppointmentsDesc.map((booking) => booking.doctor.name))).slice(0, 4);

  const careTeamDoctors = useMemo(() => {
    const doctorMap = new Map<string, DashboardDoctor>();
    for (const booking of sortedAppointmentsDesc) {
      if (booking.doctor?.id && !doctorMap.has(booking.doctor.id)) {
        const fullDoc = doctors.find((d) => d.id === booking.doctor.id);
        if (fullDoc) {
          doctorMap.set(fullDoc.id, fullDoc);
        } else {
          doctorMap.set(booking.doctor.id, {
            id: booking.doctor.id,
            name: booking.doctor.name,
            specialty: booking.doctor.specialty,
            licenseNumber: booking.doctor.licenseNumber || null,
            licenseState: booking.doctor.licenseState || null,
            npi: booking.doctor.npi || "",
            email: "",
            bio: "",
            image: null,
            availability: "",
            status: "ACTIVE",
            consultFee: 1500,
            rating: 5,
            reviewCount: 1,
            isVerified: true,
            yearsExp: null,
          });
        }
      }
    }
    if (doctorMap.size < 4) {
      for (const doc of doctors) {
        if (!doctorMap.has(doc.id)) {
          doctorMap.set(doc.id, doc);
          if (doctorMap.size >= 4) break;
        }
      }
    }
    return Array.from(doctorMap.values());
  }, [doctors, sortedAppointmentsDesc]);

  const latestVitals = useMemo(() => {
    const withVitals = sortedAppointmentsDesc.find((b) => b.bloodPressure || b.heartRate || b.bodyTemperature);
    return {
      bloodPressure: withVitals?.bloodPressure || null,
      heartRate: withVitals?.heartRate || null,
      bodyTemperature: withVitals?.bodyTemperature || null,
    };
  }, [sortedAppointmentsDesc]);

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
      value: patientAge ? `${patient.dob} · ${patientAge} years old` : patient.dob,
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
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
      label: "Blood Pressure",
      value: latestVitals.bloodPressure || "Not recorded",
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      ),
      label: "Heart Rate",
      value: latestVitals.heartRate ? `${latestVitals.heartRate} bpm` : "Not recorded",
    },
    {
      icon: (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
        </svg>
      ),
      label: "Body Temp",
      value: latestVitals.bodyTemperature ? `${latestVitals.bodyTemperature} °C` : "Not recorded",
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
          onViewAppointments={() => setActiveModule("book")}
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
      {isEditingPet && <EditPetModal pet={petProfile} onSave={handleSavePetProfile} onClose={() => setIsEditingPet(false)} />}

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
          onEnd={handleRequestEndSession}
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

      {showEndCallConfirm && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Leave Consultation"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-200/80 bg-white p-6 sm:p-7 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Warning Icon Badge */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200/70 text-rose-600 shadow-sm">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                <line x1="22" x2="2" y1="2" y2="22" />
              </svg>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-0.5 text-[11px] font-bold tracking-wide text-rose-700 border border-rose-200">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              Warning · Consultation Active
            </span>

            <h2 className="mt-3 font-display text-xl font-black text-slate-950">
              Leave Consultation Call?
            </h2>

            <p className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
              Are you sure you want to end your consultation with{" "}
              <span className="font-bold text-slate-900">
                {session.activeAppointment?.doctor?.name ? `Dr. ${session.activeAppointment.doctor.name}` : "your doctor"}
              </span>
              ? Leaving will disconnect your video and audio stream.
            </p>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <svg className="h-4 w-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>Consultation chat &amp; past notes will remain saved</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row items-center gap-2.5">
              <button
                type="button"
                disabled={isEndCallLoading}
                onClick={() => setShowEndCallConfirm(false)}
                className="w-full flex-1 rounded-xl border border-slate-200 bg-white py-3 px-4 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
              >
                Cancel - Stay on Call
              </button>
              <button
                type="button"
                disabled={isEndCallLoading}
                onClick={handleConfirmEndSession}
                className="w-full flex-1 rounded-xl bg-rose-600 py-3 px-4 text-xs font-black text-white hover:bg-rose-700 transition shadow-md shadow-rose-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isEndCallLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Ending Call...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                      <line x1="22" x2="2" y1="2" y2="22" />
                    </svg>
                    Yes, End Call
                  </>
                )}
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
                {selectedDoctor && (
                  <div className="flex items-center gap-1.5 md:col-span-2 text-xs font-semibold text-teal-800 bg-teal-50/80 border border-teal-200 rounded-xl px-3.5 py-2">
                    <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
                    <span>Doctor Available Hours: <strong className="font-black text-teal-900">{selectedDoctor.availability || "Mon - Fri, 09:00 AM - 05:00 PM"}</strong></span>
                  </div>
                )}
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
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Time Slot {selectedDoctor?.consultationDuration ? `(${selectedDoctor.consultationDuration} min)` : ""}
                    </span>
                    {availableDoctorTimeSlots.length > 0 && (
                      <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                        {availableDoctorTimeSlots.length} slots available
                      </span>
                    )}
                  </div>
                  {availableDoctorTimeSlots.length > 0 ? (
                    <select
                      value={appointmentTime}
                      onChange={(event) => setAppointmentTime(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    >
                      <option value="">-- Choose an available time slot --</option>
                      {availableDoctorTimeSlots.map((slot) => (
                        <option key={slot.time} value={slot.time}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  ) : appointmentDate ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
                      Doctor has no available clinic hours on this date.
                    </div>
                  ) : (
                    <input
                      type="time"
                      value={appointmentTime}
                      onChange={(event) => setAppointmentTime(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                    />
                  )}
                </label>
                {patientConflict && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-bold text-amber-700 md:col-span-2">
                    ⚠️ This time overlaps with one of your active consultations. Pick a suggested slot or choose another time.
                  </div>
                )}
                {!isDoctorAvailableForSlot && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700 md:col-span-2">
                    ⚠️ Dr. {selectedDoctor?.name} is not available at this time. Their available hours are{" "}
                    <span className="font-black underline">{selectedDoctor?.availability || "Mon - Fri, 09:00 AM - 05:00 PM"}</span>.
                    Please select a time during their available hours or choose from the suggested slots below.
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
                  disabled={bookingState.loading || patientConflict || !isDoctorAvailableForSlot}
                  className="w-full rounded-xl bg-brand-teal py-3.5 text-sm font-black text-white shadow-md shadow-brand-teal/20 transition-all hover:bg-brand-teal-hover active:scale-[0.99] disabled:bg-slate-300 disabled:shadow-none"
                >
                  {bookingState.loading
                    ? "Sending request…"
                    : !isDoctorAvailableForSlot
                    ? "Doctor Unavailable at Selected Time"
                    : patientConflict
                    ? "Schedule Conflict"
                    : "Send Appointment Request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {activeModule === "overview" && (() => {
        const sortedCertificatesList = [...(patient.medicalCertificates || [])].sort(
          (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
        );
        const totalCertsCount = sortedCertificatesList.length;
        const totalPrescriptionsCount = prescriptions.length;
        const nextUpcoming = upcomingAppointments[0] || null;
        const isNextRoomReady = Boolean(
          nextUpcoming && (
            authorizedRooms[nextUpcoming.id] ||
            (nextUpcoming.videoSession?.status === "STARTED" && nextUpcoming.videoSession.roomId)
          )
        );
        const recentPrescriptionsList = prescriptions.slice(0, 2);
        const recentCertificatesList = sortedCertificatesList.slice(0, 2);

        return (
          <div className="space-y-6">
            {/* ── Welcome & Patient Status Header ── */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-colors">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-brand-teal/15 text-lg font-black text-brand-teal overflow-hidden">
                    {patient.image ? (
                      <img src={patient.image} alt={patient.firstName} className="h-full w-full object-cover" />
                    ) : (
                      `${patient.firstName?.[0] || "P"}${patient.lastName?.[0] || ""}`
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-black text-slate-900">
                        Welcome back, {patient.firstName} {patient.lastName}
                      </h1>
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-teal">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                        Verified Patient
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">
                      {patientAge ? `${patientAge} yrs · ` : ""}{patient.gender ? `${patient.gender} · ` : ""}Health ID: #{patient.id.slice(-6).toUpperCase()}
                      {patient.city ? ` · ${patient.city}, ${patient.state || patient.country || ""}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModule("book")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-teal-hover active:scale-[0.98]"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Book Consultation
                  </button>
                </div>
              </div>
            </div>

            {/* ── Executive 6-Pillar Interactive KPI Stat Grid ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                {
                  label: "Upcoming Visits",
                  value: upcomingAppointments.length,
                  helper: upcomingAppointments.length === 1 ? "1 visit scheduled" : "Scheduled visits",
                  color: "text-brand-teal",
                  bg: "bg-brand-teal/10",
                  border: "border-brand-teal/20",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  ),
                  onClick: () => setActiveModule("book"),
                },
                {
                  label: "Confirmed Queue",
                  value: confirmedAppointments.length,
                  helper: confirmedAppointments.length > 0 ? "Ready for consult" : "None pending",
                  color: "text-emerald-600",
                  bg: "bg-emerald-500/10",
                  border: "border-emerald-500/20",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  ),
                  onClick: () => {
                    setActiveModule("book");
                    setAppointmentFilter("confirmed");
                  },
                },
                {
                  label: "Prescriptions",
                  value: totalPrescriptionsCount,
                  helper: "Digital Rx records",
                  color: "text-purple-600",
                  bg: "bg-purple-500/10",
                  border: "border-purple-500/20",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                      <path d="m8.5 8.5 7 7" />
                    </svg>
                  ),
                  onClick: () => {
                    setActiveModule("history");
                    setConsultationHubTab("prescriptions");
                  },
                },
                {
                  label: "Medical Certs",
                  value: totalCertsCount,
                  helper: "Official certificates",
                  color: "text-amber-600",
                  bg: "bg-amber-600/10",
                  border: "border-amber-600/20",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  ),
                  onClick: () => {
                    setActiveModule("history");
                    setConsultationHubTab("certificates");
                  },
                },
                {
                  label: "Care Team",
                  value: careTeamDoctors.length,
                  helper: "Attending clinicians",
                  color: "text-blue-600",
                  bg: "bg-blue-500/10",
                  border: "border-blue-500/20",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  ),
                  onClick: () => setActiveModule("doctors"),
                },
                {
                  label: "Completed",
                  value: completedAppointments.length,
                  helper: "Past encounters",
                  color: "text-slate-600",
                  bg: "bg-slate-500/10",
                  border: "border-slate-500/20",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="9 12 11.5 14.5 16 9" />
                    </svg>
                  ),
                  onClick: () => {
                    setActiveModule("history");
                    setConsultationFilter("past");
                  },
                },
              ].map((stat) => (
                <button
                  key={stat.label}
                  type="button"
                  onClick={stat.onClick}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:scale-[1.02] hover:border-slate-300 active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                      <span className={`text-xs opacity-60 transition group-hover:translate-x-0.5 ${stat.color}`}>→</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={`rounded-lg p-1 ${stat.bg} ${stat.color}`}>{stat.icon}</span>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400">
                    {stat.helper}
                  </p>
                </button>
              ))}
            </div>

            {/* ── Patient Basic Details (Separate Cards — Excludes Name) ── */}
            <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-xs backdrop-blur-md">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-teal/10 text-brand-teal">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Patient Profile</p>
                    <h2 className="text-sm font-black tracking-tight text-slate-950">Basic Details</h2>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Verified Patient Baseline
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModule("settings")}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-brand-teal hover:text-brand-teal transition shadow-2xs"
                  >
                    Edit in Settings →
                  </button>
                </div>
              </div>

              {/* Individual cards for each basic detail (NO NAME) */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {/* 1. Birthday / DOB */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-all hover:bg-slate-50 hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Birthday</span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-500/10 text-brand-teal">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs font-black text-slate-900 truncate">
                      {patient.dob ? formatDate(patient.dob) : "Not recorded"}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                      {patientAge ? `${patientAge} years old` : "Age unrecorded"}
                    </p>
                  </div>
                </div>

                {/* 2. Gender */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-all hover:bg-slate-50 hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gender</span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="8" r="5" />
                        <path d="M20 21a8 8 0 0 0-16 0" />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs font-black text-slate-900 capitalize">
                      {patient.gender || "Not specified"}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                      Biological Sex
                    </p>
                  </div>
                </div>

                {/* 3. Blood Type */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-all hover:bg-slate-50 hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Blood Type</span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-red-500/10 text-brand-red">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 21s6-5 6-11a6 6 0 0 0-12 0c0 6 6 11 6 11Z" />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-black text-brand-red border border-red-200/60">
                      {patient.bloodType || "N/A"}
                    </span>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                      ABO / Rh Typing
                    </p>
                  </div>
                </div>

                {/* 4. Health ID */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-all hover:bg-slate-50 hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Health ID</span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <circle cx="9" cy="10" r="2" />
                        <line x1="15" y1="8" x2="17" y2="8" />
                        <line x1="15" y1="12" x2="17" y2="12" />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="font-mono text-xs font-black text-slate-900">
                      #{patient.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                      Patient Identifier
                    </p>
                  </div>
                </div>

                {/* 5. Phone / Contact */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-all hover:bg-slate-50 hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Phone</span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.7-3.1 19.2 19.2 0 0 1-6-6A19.8 19.8 0 0 1 2 4.1 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.2 1.1.6 2.1 1.1 3a2 2 0 0 1-.4 2.1L8.6 10.6a16 16 0 0 0 4.8 4.8l1.8-1.1a2 2 0 0 1 2.1-.4c.9.5 1.9.9 3 1.1A2 2 0 0 1 22 16.9Z" />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs font-black text-slate-900 truncate">
                      {`${patient.countryCode || ""} ${patient.phone}`.trim() || "Not recorded"}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                      Primary Contact
                    </p>
                  </div>
                </div>

                {/* 6. Address / Location */}
                <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-all hover:bg-slate-50 hover:border-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Location</span>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-purple-500/10 text-purple-600">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 21s6-4.8 6-10a6 6 0 1 0-12 0c0 5.2 6 10 6 10Z" />
                        <circle cx="12" cy="11" r="2.5" />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs font-black text-slate-900 truncate">
                      {[patient.city, patient.state || patient.country].filter(Boolean).join(", ") || patient.address || "Not recorded"}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                      {patient.zipCode ? `Postal Code ${patient.zipCode}` : "Residence Area"}
                    </p>
                  </div>
                </div>
              </div>
            </section>


            {/* ── Two-Column Master Grid ── */}
            <div className="grid gap-6 xl:grid-cols-12">
              {/* Left Column (xl:col-span-7) */}
              <div className="flex flex-col gap-6 xl:col-span-7">
                {/* 1. Vital Health Baseline */}
                <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xs backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">Vital Health Baseline</p>
                      <h2 className="mt-0.5 text-lg font-black tracking-tight text-slate-950">Clinical Measurements</h2>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700 border border-emerald-200/60">
                      Vitals Monitored
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {vitalFields.map((field) => (
                      <MedicalInfoField key={field.label} icon={field.icon} label={field.label} value={field.value} />
                    ))}
                  </dl>
                </section>

                {/* 2. Clinical Risk Alerts */}
                <section className="overflow-hidden rounded-3xl border border-red-200/80 bg-gradient-to-br from-red-50/70 via-white to-white p-6 shadow-xs">
                  <div className="flex items-center justify-between gap-3 border-b border-red-100 pb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-600">Clinical Risk Alerts</p>
                      <h2 className="mt-0.5 text-lg font-black tracking-tight text-slate-950">High-Priority Safety Info</h2>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                        <path d="M10.3 4.3 2.3 18a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-13.7a2 2 0 0 0-3.4 0Z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {riskFields.map((field) => (
                      <MedicalInfoField key={field.label} icon={field.icon} label={field.label} value={field.value} emphasized />
                    ))}
                  </div>
                </section>

                {/* 3. Recent Medical Records & Documents Hub (Clinical Archive) */}
                <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xs backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-600">Clinical Archive</p>
                      <h2 className="mt-0.5 text-lg font-black tracking-tight text-slate-950">Recent Documents</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModule("history");
                        setConsultationHubTab("prescriptions");
                      }}
                      className="text-xs font-bold text-brand-teal hover:underline"
                    >
                      View Archive →
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {/* Recent Prescriptions */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-purple-100 p-1 text-purple-700">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                          </svg>
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Digital Prescriptions ({totalPrescriptionsCount})
                        </h3>
                      </div>
                      <div className="mt-2 space-y-2">
                        {recentPrescriptionsList.length > 0 ? (
                          recentPrescriptionsList.map((rx) => (
                            <div key={rx.id} className="flex items-center justify-between gap-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-xs font-bold text-slate-900">{rx.prescription}</p>
                                <p className="text-[11px] font-medium text-slate-500">
                                  Dr. {rx.doctor.name} · {formatDate(rx.scheduledAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => previewMedicalReport(rx, patient, setPreviewMedicalDoc)}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-bold text-purple-700 shadow-2xs hover:bg-purple-50 transition"
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadMedicalReport(rx, patient)}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-purple-700 px-2.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-purple-800 transition"
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 3v10" />
                                    <path d="m7 8 5 5 5-5" />
                                    <path d="M5 19h14" />
                                  </svg>
                                  Download Rx
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-400">
                            No digital prescriptions on file yet.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Recent Medical Certificates */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-amber-100 p-1 text-amber-700">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          </svg>
                        </span>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Medical Certificates ({totalCertsCount})
                        </h3>
                      </div>
                      <div className="mt-2 space-y-2">
                        {recentCertificatesList.length > 0 ? (
                          recentCertificatesList.map((cert) => (
                            <div key={cert.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-900">
                                  Cert #{cert.certNumber} · {cert.purpose.replace(/_/g, " ").toUpperCase()}
                                </p>
                                <p className="text-[11px] font-medium text-slate-500">
                                  {cert.doctor.name} · Issued {formatDate(cert.issuedAt)}
                                  {cert.diagnosis ? ` · ${cert.diagnosis}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => previewPatientCertPdf(cert, patient, setPreviewMedicalDoc)}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-700 shadow-2xs hover:bg-amber-50 transition"
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadPatientCertPdf(cert, patient)}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-700 transition"
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 3v10" />
                                    <path d="m7 8 5 5 5-5" />
                                    <path d="M5 19h14" />
                                  </svg>
                                  Download Cert
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-400">
                            No medical certificates issued yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 4. Consultation Schedule (Online Consultation) */}
                <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-xs backdrop-blur-md">

                  {/* Live room alert banner — only when room is open */}
                  {isNextRoomReady && nextUpcoming && (
                    <div className="flex items-center justify-between gap-4 border-b-2 border-emerald-400 bg-gradient-to-r from-emerald-500/10 via-brand-teal/5 to-emerald-500/5 px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                        <p className="text-xs font-black text-emerald-700">
                          Live Video Room Ready — <span className="font-semibold">Dr. {nextUpcoming.doctor.name} is waiting for you</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startLiveSession(nextUpcoming)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 transition active:scale-[0.98]"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                        Join Now →
                      </button>
                    </div>
                  )}

                  {/* Section header */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-teal text-white shadow-sm">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-teal">Online Consultation</p>
                        <h2 className="text-base font-black tracking-tight text-slate-950">Consultation Schedule</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-600">{upcomingAppointments.length} upcoming</span>
                      <button
                        type="button"
                        onClick={() => setActiveModule("book")}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:border-brand-teal hover:text-brand-teal transition"
                      >
                        View All →
                      </button>
                    </div>
                  </div>

                  {/* Schedule rows */}
                  <div className="divide-y divide-slate-100">
                    {upcomingAppointments.length > 0 ? (
                      upcomingAppointments.slice(0, 5).map((booking, idx) => {
                        const roomReady = Boolean(authorizedRooms[booking.id] || (booking.videoSession?.status === "STARTED" && booking.videoSession.roomId));
                        const isNext = idx === 0;

                        return (
                          <div key={booking.id} className={`px-6 py-4 transition ${isNext ? "bg-brand-teal/[0.03]" : "hover:bg-slate-50/60"}`}>
                            <div className="flex items-start gap-4">
                              {/* Rank + doctor avatar */}
                              <div className="flex flex-col items-center gap-1.5 shrink-0">
                                <span className={`text-[10px] font-black ${isNext ? "text-brand-teal" : "text-slate-400"}`}>#{idx + 1}</span>
                                <div className={`grid h-10 w-10 place-items-center rounded-xl text-xs font-black ${isNext ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-600"}`}>
                                  {booking.doctor.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                                </div>
                              </div>

                              {/* Main info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-black text-slate-950">{booking.doctor.name}</p>
                                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${getAppointmentStatusStyle(booking.status)}`}>
                                    {booking.status}
                                  </span>
                                  {isNext && <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-brand-teal">Next Up</span>}
                                  {roomReady && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-800 animate-pulse">
                                      ● Room Open
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs font-semibold text-brand-teal">{booking.doctor.specialty}</p>
                                {booking.reason && (
                                  <p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-1">Reason: {booking.reason}</p>
                                )}
                              </div>

                              {/* Date / time + action */}
                              <div className="flex flex-col items-end gap-2 shrink-0 text-right">
                                <p className="text-xs font-bold text-slate-800">{formatDate(booking.scheduledAt)}</p>
                                <p className="text-[11px] font-semibold text-slate-500">{formatTime(booking.scheduledAt)} · {booking.duration || 30} min</p>
                                {roomReady ? (
                                  <button
                                    type="button"
                                    onClick={() => startLiveSession(booking)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                                  >
                                    Join Video →
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAppointmentId(booking.id);
                                      setActiveModule("book");
                                    }}
                                    className="text-xs font-bold text-brand-teal hover:underline"
                                  >
                                    Details →
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-6 py-10 text-center">
                        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <p className="text-sm font-black text-slate-500">No Scheduled Consultations</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">Need medical advice or a prescription? Connect with a verified doctor.</p>
                        <button
                          type="button"
                          onClick={() => setActiveModule("book")}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white hover:bg-teal-600 transition"
                        >
                          Schedule Consultation →
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Right Column (xl:col-span-5) */}
              <div className="flex flex-col gap-6 xl:col-span-5">
                {/* 1. Digital Medical ID / Companion Pet Pass */}
                <section className="rounded-3xl border border-brand-teal/20 bg-gradient-to-br from-brand-teal/10 via-white to-slate-50/50 p-6 shadow-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-brand-teal/10 p-1.5 text-brand-teal">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Digital Pass</p>
                        <h2 className="text-base font-black text-slate-950">
                          {qrViewMode === "patient" ? "Patient Medical ID" : "Companion Pet Pass"}
                        </h2>
                      </div>
                    </div>
                    {/* View Switcher: Patient ID vs Pet Pass */}
                    <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setQrViewMode("patient")}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition ${
                          qrViewMode === "patient" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Patient
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrViewMode("pet")}
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase transition ${
                          qrViewMode === "pet" ? "bg-brand-teal text-white shadow-2xs" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Pet 🐾
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col items-center text-center">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-950/5">
                      <PatientQrCode svgMarkup={qrViewMode === "patient" ? medicalIdQrSvg : petQrSvg} />
                    </div>

                    {qrViewMode === "patient" ? (
                      <>
                        <div className="mt-4">
                          <p className="text-sm font-black text-slate-900">{patient.firstName} {patient.lastName}</p>
                          <p className="text-xs font-semibold text-slate-500">
                            ID: #{patient.id.slice(-8).toUpperCase()} · Blood Type: {patient.bloodType || "N/A"}
                          </p>
                        </div>

                        <div className="mt-4 flex w-full gap-2">
                          <button
                            type="button"
                            onClick={handleCopyMedicalIdLink}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-brand-teal hover:text-brand-teal transition active:scale-[0.98]"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                            </svg>
                            {medicalIdAction === "copied" ? "Copied!" : "Copy Link"}
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadMedicalIdQr}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-teal py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-brand-teal-hover transition active:scale-[0.98]"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 3v10" />
                              <path d="m7 8 5 5 5-5" />
                              <path d="M5 19h14" />
                            </svg>
                            {medicalIdAction === "downloaded" ? "Saved!" : "Download QR"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mt-4">
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/80 px-2.5 py-0.5 text-[10px] font-black text-teal-800 uppercase">
                            🐾 {petProfile.species} · {petProfile.breed}
                          </div>
                          <p className="mt-1.5 text-sm font-black text-slate-900">{petProfile.name}</p>
                          <p className="text-xs font-semibold text-slate-500">
                            Microchip: #{petProfile.microchipId} · {petProfile.vaccinationStatus}
                          </p>
                        </div>

                        <div className="mt-4 flex w-full gap-2">
                          <button
                            type="button"
                            onClick={handleCopyPetPassLink}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-brand-teal hover:text-brand-teal transition active:scale-[0.98]"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                            </svg>
                            {petQrAction === "copied" ? "Copied!" : "Copy Pet Link"}
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadPetQr}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-teal py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-brand-teal-hover transition active:scale-[0.98]"
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 3v10" />
                              <path d="m7 8 5 5 5-5" />
                              <path d="M5 19h14" />
                            </svg>
                            {petQrAction === "downloaded" ? "Saved!" : "Download Pet QR"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </section>

                {/* 2. Registered Pet Details & Companion Care (Below the QR) */}
                <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-teal-50 p-1.5 text-teal-700 border border-teal-200/60">
                        <span className="text-sm">🐾</span>
                      </span>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Companion Care</p>
                        <h2 className="text-base font-black text-slate-950">Pet Details</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-teal-50 border border-teal-200/80 px-2 py-0.5 text-[9px] font-black uppercase text-teal-700">
                        {petProfile.vaccinationStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingPet(true)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-brand-teal hover:text-brand-teal transition"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {/* Pet Identity Header */}
                  <div className="mt-4 flex items-center gap-3.5 rounded-2xl border border-teal-100 bg-teal-50/30 p-3.5">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-100/70 text-2xl border border-teal-200/70 shadow-2xs">
                      {petProfile.species.toLowerCase().includes("cat") || petProfile.species.toLowerCase().includes("feline") ? "🐱" : "🐶"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-950 truncate">{petProfile.name}</h3>
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-black text-emerald-800">
                          Verified Pet
                        </span>
                      </div>
                      <p className="text-xs font-bold text-brand-teal truncate">
                        {petProfile.breed} · {petProfile.species}
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 truncate">
                        {petProfile.age} · {petProfile.gender} · {petProfile.weight}
                      </p>
                    </div>
                  </div>

                  {/* 4-Item Quick Stats Grid */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Microchip No.</p>
                      <p className="mt-0.5 truncate text-xs font-black text-slate-800">#{petProfile.microchipId}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Rabies Tag</p>
                      <p className="mt-0.5 truncate text-xs font-black text-slate-800">#{petProfile.rabiesTagNumber}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Last Vaccine</p>
                      <p className="mt-0.5 truncate text-xs font-black text-slate-800">{petProfile.lastVaccinationDate}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Primary Vet</p>
                      <p className="mt-0.5 truncate text-xs font-black text-slate-800">{petProfile.primaryVet}</p>
                    </div>
                  </div>

                  {/* Veterinary Clinic & Notes */}
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Attending Clinic</p>
                      <p className="mt-0.5 font-bold text-slate-800">{petProfile.clinicName}</p>
                      <p className="text-[11px] font-medium text-slate-500">Phone: {petProfile.clinicPhone}</p>
                    </div>

                    {petProfile.allergies && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 text-amber-900">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Allergies & Sensitivities</p>
                        <p className="mt-0.5 font-semibold text-[11px]">{petProfile.allergies}</p>
                      </div>
                    )}

                    {petProfile.dietNotes && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Diet & Nutrition</p>
                        <p className="mt-0.5 font-medium text-[11px] text-slate-600">{petProfile.dietNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setQrViewMode(qrViewMode === "pet" ? "patient" : "pet")}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/40 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100/60 transition active:scale-[0.98]"
                    >
                      <span>{qrViewMode === "pet" ? "Show Patient QR" : "Show Pet QR Pass"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPet(true)}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition active:scale-[0.98]"
                    >
                      Edit Profile
                    </button>
                  </div>
                </section>

                {/* 2. Emergency Contact */}
                <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-rose-100 p-1.5 text-rose-600">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.7-3.1 19.2 19.2 0 0 1-6-6A19.8 19.8 0 0 1 2 4.1 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.2 1.1.6 2.1 1.1 3a2 2 0 0 1-.4 2.1L8.6 10.6a16 16 0 0 0 4.8 4.8l1.8-1.1a2 2 0 0 1 2.1-.4c.9.5 1.9.9 3 1.1A2 2 0 0 1 22 16.9Z" />
                        </svg>
                      </span>
                      <h2 className="text-sm font-black text-slate-950">Emergency Contact</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule("settings")}
                      className="text-[11px] font-bold text-brand-teal hover:underline"
                    >
                      Update
                    </button>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <p className="text-sm font-bold text-slate-900">
                      {patient.emergencyContactName || "No emergency contact specified"}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      {patient.emergencyContactRelation ? `Relation: ${patient.emergencyContactRelation} · ` : ""}
                      {patient.emergencyContactPhone || "No phone number"}
                    </p>
                  </div>
                </section>

                {/* 3. My Care Team / Attending Doctors */}
                <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Care Network</p>
                      <h2 className="text-base font-black text-slate-950">My Care Team</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModule("doctors")}
                      className="text-xs font-bold text-brand-teal hover:underline"
                    >
                      Directory →
                    </button>
                  </div>

                  <div className="mt-3 divide-y divide-slate-100">
                    {careTeamDoctors.slice(0, 3).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-xs font-black text-brand-teal overflow-hidden">
                            {doc.image ? (
                              <img src={doc.image} alt={doc.name} className="h-full w-full object-cover" />
                            ) : (
                              doc.name.split(" ").map((n) => n[0]).slice(0, 2).join("")
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900">{doc.name}</p>
                            <p className="text-[11px] font-medium text-slate-500">{doc.specialty}</p>
                            {doc.consultFee && (
                              <p className="text-[10px] font-bold text-brand-teal">
                                {formatPhilippinePeso(doc.consultFee)}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDoctorId(doc.id);
                            setActiveModule("book");
                          }}
                          className="rounded-lg border border-brand-teal/30 bg-brand-teal/5 px-2.5 py-1 text-xs font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition"
                        >
                          Book Visit
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 4. Quick Health Launcher */}
                <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Quick Health Navigation
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveModule("book")}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-left text-xs font-bold text-slate-800 transition hover:border-brand-teal hover:bg-white hover:text-brand-teal"
                    >
                      <span className="rounded-lg bg-brand-teal/10 p-1 text-brand-teal">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                        </svg>
                      </span>
                      Book Visit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModule("history");
                        setConsultationHubTab("prescriptions");
                      }}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-left text-xs font-bold text-slate-800 transition hover:border-brand-teal hover:bg-white hover:text-brand-teal"
                    >
                      <span className="rounded-lg bg-purple-100 p-1 text-purple-700">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                        </svg>
                      </span>
                      Prescriptions
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModule("history");
                        setConsultationHubTab("certificates");
                      }}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-left text-xs font-bold text-slate-800 transition hover:border-brand-teal hover:bg-white hover:text-brand-teal"
                    >
                      <span className="rounded-lg bg-amber-100 p-1 text-amber-700">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        </svg>
                      </span>
                      Certificates
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule("settings")}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-left text-xs font-bold text-slate-800 transition hover:border-brand-teal hover:bg-white hover:text-brand-teal"
                    >
                      <span className="rounded-lg bg-slate-200 p-1 text-slate-700">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                      </span>
                      My Settings
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        );
      })()}

      {activeModule === "book" && (
        <section className="space-y-6">
          {/* Horizontal Chronological Feed Section */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Chronological Feed</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">
                    {appointmentFeed.length}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {selectedCalendarDate ? `Appointments on ${selectedCalendarDate}` : "Your Consultation Appointments"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {APPOINTMENT_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setAppointmentFilter(filter.id)}
                      className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase transition ${
                        appointmentFilter === filter.id ? "bg-brand-teal text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                  {selectedCalendarDate && (
                    <button
                      type="button"
                      onClick={() => setSelectedCalendarDate("")}
                      className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase text-white hover:bg-slate-800"
                    >
                      Clear Date ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveModule("doctors")}
                    className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-[0.98]"
                  >
                    Doctor Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingState({ loading: false, error: "", success: "" });
                      setIsBookingOpen(true);
                    }}
                    className="rounded-xl bg-brand-teal px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-teal-hover transition active:scale-[0.98]"
                  >
                    + Book Appointment
                  </button>
                </div>
              </div>
            </div>

            {/* Horizontal Scrolling Card Track */}
            <div className="mt-4">
              {appointmentFeed.length ? (
                <div className="flex flex-row gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth">
                  {appointmentFeed.map((booking) => {
                    const isSelected = selectedAppointment?.id === booking.id;
                    const roomReady = Boolean(authorizedRooms[booking.id] || startedAppointmentId === booking.id);

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedAppointmentId(isSelected ? "" : booking.id)}
                        className={`group flex w-[290px] shrink-0 flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
                          isSelected
                            ? "border-brand-teal bg-teal-50/20 shadow-md ring-2 ring-brand-teal/30"
                            : "border-slate-200/90 bg-white hover:border-brand-teal/40 hover:shadow-sm"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-xs font-black text-brand-teal">
                                {getInitials(booking.doctor.name) || "DR"}
                              </div>
                              <div className="min-w-0">
                                <h4 className="truncate text-xs font-black text-slate-950">{booking.doctor.name}</h4>
                                <p className="truncate text-[11px] font-bold text-brand-teal">{booking.doctor.specialty}</p>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${getAppointmentStatusStyle(booking.status)}`}>
                              {booking.status}
                            </span>
                          </div>
                          {roomReady && (
                            <div className="mt-2.5">
                              <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-brand-red px-2 py-0.5 text-[9px] font-black uppercase text-white">
                                ● Room Ready
                              </span>
                            </div>
                          )}
                          {booking.reason && (
                            <p className="mt-2.5 line-clamp-2 text-xs font-medium leading-relaxed text-slate-600">
                              {booking.reason}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
                          <span className="font-black text-slate-700">{formatAppointmentFeedDate(booking.scheduledAt)}</span>
                          <span className="font-bold text-slate-500">{formatAppointmentFeedTime(booking.scheduledAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6">
                  <EmptyState title="No appointments match this view" body="Change filters or book a new consultation request." />
                </div>
              )}
            </div>

            {/* Selected Appointment Details Drawer */}
            {selectedAppointment && (
              <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/30 p-4 transition-all">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Selected Consultation Details</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${getAppointmentStatusStyle(selectedAppointment.status)}`}>
                        {selectedAppointment.status}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-slate-950">{selectedAppointment.doctor.name} ({selectedAppointment.doctor.specialty})</h3>
                    <p className="text-xs font-bold text-slate-600">{formatDateTime(selectedAppointment.scheduledAt)}</p>
                    <div className={`mt-2 rounded-xl border p-3 text-xs font-bold ${
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
                    {selectedAppointment.reason && (
                      <p className="text-xs font-medium text-slate-700 pt-1"><strong className="text-slate-900">Visit Reason:</strong> {selectedAppointment.reason}</p>
                    )}
                    {selectedAppointment.prescription && (
                      <p className="text-xs font-medium text-slate-700"><strong className="text-slate-900">Prescription:</strong> {selectedAppointment.prescription}</p>
                    )}
                    {selectedAppointment.notes && (
                      <p className="text-xs font-medium text-slate-700"><strong className="text-slate-900">Notes:</strong> {selectedAppointment.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {selectedAppointment.status === "CONFIRMED" && (
                      <button
                        type="button"
                        onClick={() => startLiveSession(selectedAppointment)}
                        className="rounded-xl bg-brand-red px-4 py-2.5 text-xs font-black text-white shadow-xs hover:bg-red-600 transition"
                      >
                        {authorizedRooms[selectedAppointment.id] ? "Join Consultation Room" : "Check Live Room"}
                      </button>
                    )}
                    {selectedAppointment.status === "PENDING" && isDoctorFollowUp(selectedAppointment) && (
                      <>
                        <button
                          type="button"
                          disabled={followUpActionId === selectedAppointment.id}
                          onClick={() => void handleConfirmFollowUp(selectedAppointment)}
                          className="rounded-xl bg-brand-teal px-3.5 py-2 text-xs font-black text-white disabled:bg-slate-300"
                        >
                          Confirm Follow-Up
                        </button>
                        <button
                          type="button"
                          disabled={followUpActionId === selectedAppointment.id}
                          onClick={() => openFollowUpReschedule(selectedAppointment)}
                          className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-black text-amber-800 disabled:text-slate-400"
                        >
                          Request Reschedule
                        </button>
                      </>
                    )}
                    {selectedAppointment.status === "CANCELLED" && selectedAppointment.notes?.toLowerCase().includes("no show") && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedAppointment.doctor.id) {
                            setSelectedDoctorId(selectedAppointment.doctor.id);
                          }
                          setIsBookingOpen(true);
                        }}
                        className="rounded-xl bg-brand-teal px-3.5 py-2 text-xs font-black text-white hover:bg-brand-teal-hover transition"
                      >
                        Book New Consultation
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedAppointmentId("")}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Interactive Doctor-Synced Appointment Calendar Section */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-3.5 min-w-0">
                {selectedDoctor?.image ? (
                  <Image
                    src={selectedDoctor.image}
                    alt={selectedDoctor.name}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 shrink-0 rounded-2xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-teal/10 text-sm font-black text-brand-teal">
                    {getInitials(selectedDoctor?.name || "") || "DR"}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Doctor Schedule & Availability</p>
                    {selectedDoctor?.isVerified && (
                      <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.2 text-[9px] font-black text-teal-700">Verified</span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-slate-950 truncate">
                    {selectedDoctor ? `Dr. ${selectedDoctor.name}` : "Select a Doctor"}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 truncate">
                    {selectedDoctor?.specialty} • Hours: <strong className="text-slate-800 font-bold">{selectedDoctor?.availability || "Mon - Fri, 09:00 AM - 05:00 PM"}</strong>
                    {selectedDoctor?.consultFee ? ` • Fee: ${formatPhilippinePeso(selectedDoctor.consultFee)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="calendar-doctor-select" className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Viewing:
                </label>
                <select
                  id="calendar-doctor-select"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-xs focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                >
                  {doctors.filter((d) => d.isVerified).map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.specialty})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <AppointmentCalendar
              variant="stage"
              viewMode={calendarView}
              onViewModeChange={setCalendarView}
              anchorDate={calendarAnchorDate}
              onAnchorDateChange={setCalendarAnchorDate}
              availability={selectedDoctor?.availability}
              consultationDuration={selectedDoctor?.consultationDuration || 30}
              appointments={calendarAppointments}
              onSelectSlot={(slot) => {
                if (selectedDoctor?.id) {
                  setSelectedDoctorId(selectedDoctor.id);
                }
                setAppointmentDate(toLocalDateKey(slot));
                setAppointmentTime(toLocalTimeKey(slot));
                setBookingState({ loading: false, error: "", success: "" });
                setIsBookingOpen(true);
              }}
              onSelectDate={(date) => {
                if (selectedDoctor?.id) {
                  setSelectedDoctorId(selectedDoctor.id);
                }
                setAppointmentDate(toLocalDateKey(date));
                setAppointmentTime("");
                setBookingState({ loading: false, error: "", success: "" });
                setIsBookingOpen(true);
              }}
            />
          </section>
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
            onDismissPresentation={handleDismissPresentation}
            onEnd={handleRequestEndSession}
            localStream={webRTC.localStream}
            screenShareStream={webRTC.screenShareStream}
            remoteStream={webRTC.remoteStream}
            connectionState={webRTC.connectionState}
            mediaError={webRTC.error}
            screenShareSupported={webRTC.screenShareSupported}
            scheduledDurationMinutes={session.activeAppointment.duration || 30}
            onExtendCall={handleExtendCall}
            externalExtendedMinutes={callExtendedMinutes}
            appointmentId={session.activeAppointment.id}
            doctorName={session.activeAppointment.doctor.name}
            patientName={`${patient.firstName} ${patient.lastName}`}
            messages={session.messages}
            sessionTranscriptTurns={session.transcriptTurns}
            onNewTranscriptTurn={(turn) => session.addTranscriptTurn(turn)}
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
            <div className="flex flex-row items-center justify-between gap-4 rounded-2xl border border-brand-teal/20 bg-gradient-to-r from-brand-teal/10 via-white to-slate-50/50 px-6 py-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal text-white shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Online Consultation</p>
                  <h2 className="text-lg font-black text-slate-950">Live Consultation Hub</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setManageApptAction("idle"); setManageApptSelected(null); setManageAppointmentsOpen(true); }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-xs hover:border-brand-teal hover:text-brand-teal transition"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Manage Appointments
              </button>
            </div>

            {/* ── My Timeline — CRM-Style List View ── */}
            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-teal/10 text-brand-teal">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-950">My Timeline</h3>
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-black text-slate-700">
                        {consultationTimeline.length}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500">Consultation records & schedule pipeline</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1 rounded-lg bg-slate-200/70 p-0.5">
                    {CONSULTATION_TIMELINE_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setConsultationFilter(filter.id)}
                        className={`rounded-md px-3 py-1 text-[11px] font-black transition ${
                          consultationFilter === filter.id ? "bg-white text-brand-teal shadow-xs" : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CRM Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-3 border-b border-slate-200 bg-slate-100/60 px-5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <div className="col-span-5 sm:col-span-4">Consultation / Doctor</div>
                <div className="col-span-3 sm:col-span-3">Specialty</div>
                <div className="col-span-2 sm:col-span-3">Date & Time</div>
                <div className="col-span-2 sm:col-span-2 text-right">Status</div>
              </div>

              {/* CRM List rows */}
              {consultationTimeline.length ? (
                <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                  {consultationTimeline.map((booking) => {
                    const isSelected = selectedAppointment?.id === booking.id;
                    const roomReady = Boolean(authorizedRooms[booking.id] || startedAppointmentId === booking.id);
                    const doctorProfile = doctors.find((doctor) => doctor.id === booking.doctor.id);
                    const initials = getInitials(booking.doctor.name) || "DR";

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedAppointmentId(booking.id)}
                        className={`group w-full text-left transition-all duration-150 relative ${
                          isSelected
                            ? "bg-brand-teal/5 text-slate-950"
                            : "hover:bg-slate-50/80 text-slate-700"
                        }`}
                      >
                        {/* CRM Selection Accent Bar */}
                        {isSelected && (
                          <div className="absolute inset-y-0 left-0 w-1 bg-brand-teal rounded-r" />
                        )}

                        <div className="px-5 py-3 sm:py-3.5 flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-3 sm:items-center">
                          {/* Doctor & Avatar */}
                          <div className="sm:col-span-4 flex items-center gap-3 min-w-0">
                            {doctorProfile?.image ? (
                              <Image
                                src={doctorProfile.image}
                                alt={booking.doctor.name}
                                width={36}
                                height={36}
                                unoptimized
                                className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-xs font-black text-brand-teal ring-1 ring-brand-teal/20">
                                {initials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black text-slate-950 group-hover:text-brand-teal transition-colors">
                                {booking.doctor.name}
                              </p>
                              <p className="truncate text-[11px] text-slate-500 font-medium sm:hidden">
                                {booking.doctor.specialty}
                              </p>
                            </div>
                          </div>

                          {/* Specialty */}
                          <div className="hidden sm:block sm:col-span-3 min-w-0">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                              {booking.doctor.specialty}
                            </span>
                          </div>

                          {/* Date & Time */}
                          <div className="sm:col-span-3 flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-800">{formatAppointmentFeedDate(booking.scheduledAt)}</span>
                            <span className="text-slate-400 font-medium">·</span>
                            <span className="font-semibold text-slate-500">{formatAppointmentFeedTime(booking.scheduledAt)}</span>
                          </div>

                          {/* Status Badge & Room indicator */}
                          <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 shrink-0">
                            {roomReady && (
                              <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Ready
                              </span>
                            )}
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${getAppointmentStatusStyle(booking.status)}`}>
                              {booking.status}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-5 py-8">
                  <EmptyState title="No consultations match this view" body="Book an appointment or switch timeline tabs." />
                </div>
              )}
            </section>

            {/* ── Action Hub ── */}
            <div className="grid gap-5">

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
                              onClick={() => {
                                if (selectedAppointment.status === "COMPLETED") {
                                  setMedicalRecordModalAppointment(selectedAppointment);
                                } else {
                                  setManageApptSelected(selectedAppointment);
                                  setManageApptAction("idle");
                                  setManageAppointmentsOpen(true);
                                }
                              }}
                              className="rounded-xl bg-white px-4 py-3 text-xs font-black text-slate-950 shadow-sm hover:bg-slate-100 transition"
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
                        {consultationHubTab === "certificates" && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Medical Certificate</p>
                            </div>
                            {(() => {
                              const cert = [...(patient.medicalCertificates || [])]
                                .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
                                .find(
                                  (c) => c.consultationId === selectedAppointment.id || c.doctor?.id === selectedAppointment.doctor.id
                                );
                              if (!cert) {
                                return (
                                  <p className="text-sm font-semibold text-slate-600 leading-relaxed">
                                    No medical certificate has been issued for this consultation yet. You may request one from your doctor during or following your consultation.
                                  </p>
                                );
                              }
                              return (
                                <div className="space-y-3 rounded-lg border border-teal-200/80 bg-white p-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                      <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-black text-brand-teal border border-teal-200 mr-2">
                                        {cert.certNumber}
                                      </span>
                                      <span className="text-xs font-bold text-slate-800">
                                        {cert.purpose === "sick_leave" ? "Sick Leave / Medical Rest" : cert.purpose === "fitness_to_work" ? "Fitness to Return to Work" : cert.purpose === "school" ? "Academic Clearance" : "Medical Certificate"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => previewPatientCertPdf(cert, patient, setPreviewMedicalDoc)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50 transition"
                                      >
                                        <svg className="h-3.5 w-3.5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                          <circle cx="12" cy="12" r="3" />
                                        </svg>
                                        Preview
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => downloadPatientCertPdf(cert, patient)}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-black text-white hover:bg-teal-600 transition"
                                      >
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Download PDF
                                      </button>
                                    </div>
                                  </div>
                                  {cert.diagnosis && (
                                    <p className="text-xs text-slate-700"><strong>Diagnosis:</strong> {cert.diagnosis}</p>
                                  )}
                                  {(cert.restDaysFrom || cert.restDaysTo) && (
                                    <p className="text-xs text-teal-800"><strong>Leave Period:</strong> {cert.restDaysFrom ? formatDate(cert.restDaysFrom) : "Start"} to {cert.restDaysTo ? formatDate(cert.restDaysTo) : "End"}</p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                        {consultationHubTab === "documents" && (
                          <div className="space-y-4">
                            {/* CRM-Style Encounter Documents Registry */}
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                              {/* CRM Header Bar */}
                              <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 sm:px-5">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal-500/10 text-brand-teal">
                                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                      </svg>
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                                          Encounter Document Registry
                                        </h4>
                                        <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-black text-brand-teal">
                                          Official Records
                                        </span>
                                      </div>
                                      <p className="text-[11px] font-medium text-slate-500">
                                        Validated clinical encounter reports, digital prescriptions, certificates, and recordings.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-lg bg-slate-200/80 px-2.5 py-1 text-[11px] font-black text-slate-700">
                                      Appointment #{selectedAppointment.id.slice(-6).toUpperCase()}
                                    </span>
                                  </div>
                                </div>

                                {/* Desktop Table Header */}
                                <div className="hidden sm:grid grid-cols-12 gap-3 border-t border-slate-200/80 mt-3 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                  <div className="col-span-5">Document &amp; Description</div>
                                  <div className="col-span-2">Classification</div>
                                  <div className="col-span-2">Physician / Date</div>
                                  <div className="col-span-3 text-right">Actions</div>
                                </div>
                              </div>

                              {/* CRM Document Rows with initial view of 5 items and vertical scroll */}
                              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                                {/* 1. Consultation Report PDF */}
                                <div className="group flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center hover:bg-slate-50/70 transition">
                                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-2xs">
                                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-950 truncate">Consultation Encounter Report</p>
                                      <p className="mt-0.5 text-[10px] font-medium text-slate-500 line-clamp-1">
                                        Clinical notes, vitals summary, assessment &amp; treatment plan
                                      </p>
                                    </div>
                                  </div>

                                  <div className="col-span-2">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                      Clinical Report
                                    </span>
                                  </div>

                                  <div className="col-span-2 text-xs text-slate-600">
                                    <p className="font-bold text-slate-800 truncate">Dr. {selectedAppointment.doctor.name}</p>
                                    <p className="text-[10px] text-slate-400">{formatDate(selectedAppointment.scheduledAt)}</p>
                                  </div>

                                  <div className="col-span-3 flex items-center justify-start sm:justify-end gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => previewFullConsultationReport(selectedAppointment, patient, setPreviewMedicalDoc)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs transition"
                                    >
                                      <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                        <circle cx="12" cy="12" r="3" />
                                      </svg>
                                      Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => downloadFullConsultationReport(selectedAppointment, patient)}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-black text-white hover:bg-slate-800 shadow-2xs transition"
                                    >
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                      </svg>
                                      Download PDF
                                    </button>
                                  </div>
                                </div>

                                {/* 2. Official Medical Certificate PDF (if available) */}
                                {(() => {
                                  const cert = [...(patient.medicalCertificates || [])]
                                    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
                                    .find(
                                      (c) => c.consultationId === selectedAppointment.id || c.doctor?.id === selectedAppointment.doctor.id
                                    );
                                  if (!cert) return null;
                                  return (
                                    <div className="group flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center bg-teal-50/30 hover:bg-teal-50/60 transition">
                                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal text-white shadow-2xs">
                                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                            <path d="m9 12 2 2 4-4" />
                                          </svg>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-black text-teal-950 truncate">Official Medical Certificate</p>
                                          <p className="mt-0.5 text-[10px] font-medium text-teal-700 line-clamp-1">
                                            {cert.certNumber} · {cert.purpose === "sick_leave" ? "Sick Leave / Rest" : cert.purpose === "fitness_to_work" ? "Fitness Clearance" : cert.purpose === "school" ? "Academic Clearance" : "Medical Certificate"}{cert.diagnosis ? ` (${cert.diagnosis})` : ""}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="col-span-2">
                                        <span className="inline-flex items-center gap-1 rounded-md bg-teal-100/80 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                                          <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                                          Medical Cert
                                        </span>
                                      </div>

                                      <div className="col-span-2 text-xs text-slate-600">
                                        <p className="font-bold text-slate-800 truncate">Dr. {cert.doctor.name}</p>
                                        <p className="text-[10px] text-slate-400">{formatDate(cert.issuedAt)}</p>
                                      </div>

                                      <div className="col-span-3 flex items-center justify-start sm:justify-end gap-2 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => previewPatientCertPdf(cert, patient, setPreviewMedicalDoc)}
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50 shadow-2xs transition"
                                        >
                                          <svg className="h-3.5 w-3.5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                            <circle cx="12" cy="12" r="3" />
                                          </svg>
                                          Preview
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => downloadPatientCertPdf(cert, patient)}
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-teal px-2.5 py-1.5 text-xs font-black text-white hover:bg-teal-600 shadow-2xs transition"
                                        >
                                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                          </svg>
                                          Download PDF
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* 3. Official E-Prescription PDF (if available) */}
                                {selectedAppointment.prescription ? (
                                  <div className="group flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center bg-purple-50/30 hover:bg-purple-50/60 transition">
                                    <div className="col-span-5 flex items-center gap-3 min-w-0">
                                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-700 text-white shadow-2xs">
                                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-black text-purple-950 truncate">Official E-Prescription (Rx)</p>
                                        <p className="mt-0.5 text-[10px] font-medium text-purple-700 line-clamp-1">
                                          E-Signed · DOH &amp; FDA compliant electronic prescription
                                        </p>
                                      </div>
                                    </div>

                                    <div className="col-span-2">
                                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                                        <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                                        Digital Rx
                                      </span>
                                    </div>

                                    <div className="col-span-2 text-xs text-slate-600">
                                      <p className="font-bold text-slate-800 truncate">Dr. {selectedAppointment.doctor.name}</p>
                                      <p className="text-[10px] text-slate-400">{formatDate(selectedAppointment.scheduledAt)}</p>
                                    </div>

                                    <div className="col-span-3 flex items-center justify-start sm:justify-end gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => previewMedicalReport(selectedAppointment, patient, setPreviewMedicalDoc)}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-50 shadow-2xs transition"
                                      >
                                        <svg className="h-3.5 w-3.5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                          <circle cx="12" cy="12" r="3" />
                                        </svg>
                                        Preview
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => downloadMedicalReport(selectedAppointment, patient)}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-2.5 py-1.5 text-xs font-black text-white hover:bg-purple-800 shadow-2xs transition"
                                      >
                                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                          <polyline points="7 10 12 15 17 10" />
                                          <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Download Rx
                                      </button>
                                    </div>
                                  </div>
                                ) : null}

                                {/* 4. Consultation Dialogue Transcript PDF */}
                                <div className="group flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center hover:bg-slate-50/70 transition">
                                  <div className="col-span-5 flex items-center gap-3 min-w-0">
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-700 text-white shadow-2xs">
                                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                      </svg>
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-slate-950 truncate">Call Speech Transcript</p>
                                      <p className="mt-0.5 text-[10px] font-medium text-slate-500 line-clamp-1">
                                        Synchronous audio/video dialogue transcription with speaker turn logs
                                      </p>
                                    </div>
                                  </div>

                                  <div className="col-span-2">
                                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                      Call Transcript
                                    </span>
                                  </div>

                                  <div className="col-span-2 text-xs text-slate-600">
                                    <p className="font-bold text-slate-800 truncate">Dr. {selectedAppointment.doctor.name}</p>
                                    <p className="text-[10px] text-slate-400">{formatDate(selectedAppointment.scheduledAt)}</p>
                                  </div>

                                  <div className="col-span-3 flex items-center justify-start sm:justify-end gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => previewTranscriptReport(selectedAppointment, patient, setPreviewMedicalDoc)}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs transition"
                                    >
                                      <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                        <circle cx="12" cy="12" r="3" />
                                      </svg>
                                      Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => downloadTranscriptReport(selectedAppointment, patient)}
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-2.5 py-1.5 text-xs font-black text-white hover:bg-sky-800 shadow-2xs transition"
                                    >
                                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                      </svg>
                                      Download PDF
                                    </button>
                                  </div>
                                </div>

                                {/* 5. Previous / Uploaded Medical Documents */}
                                {medicalDocuments.map((doc) => {
                                  const catCfg = CATEGORY_CONFIG[doc.category] || CATEGORY_CONFIG.other;
                                  return (
                                    <div
                                      key={doc.id}
                                      className="group flex flex-col sm:grid sm:grid-cols-12 gap-3 p-4 sm:items-center hover:bg-slate-50/70 transition"
                                    >
                                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-brand-teal shadow-2xs">
                                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                          </svg>
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-black text-slate-950 truncate group-hover:text-brand-teal transition-colors">
                                            {doc.title}
                                          </p>
                                          <p className="mt-0.5 text-[10px] font-medium text-slate-500 line-clamp-1">
                                            {doc.notes || "Archived patient clinical document"}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="col-span-2">
                                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${catCfg.badgeClass}`}>
                                          {catCfg.label}
                                        </span>
                                      </div>

                                      <div className="col-span-2 text-xs text-slate-600">
                                        <p className="font-bold text-slate-800 truncate">{doc.doctorOrClinic || "External Provider"}</p>
                                        <p className="text-[10px] text-slate-400">{formatDocDate(doc.consultationDate)} · {doc.fileSize}</p>
                                      </div>

                                      <div className="col-span-3 flex items-center justify-start sm:justify-end gap-2 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewMedicalDoc(doc)}
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs transition"
                                        >
                                          <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                            <circle cx="12" cy="12" r="3" />
                                          </svg>
                                          Preview
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (doc.fileData) {
                                              const a = document.createElement("a");
                                              a.href = doc.fileData;
                                              a.download = doc.fileName;
                                              document.body.appendChild(a);
                                              a.click();
                                              document.body.removeChild(a);
                                            } else {
                                              downloadMedicalArchiveSamplePdf(doc);
                                            }
                                          }}
                                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-teal px-2.5 py-1.5 text-xs font-black text-white hover:bg-teal-600 shadow-2xs transition"
                                        >
                                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                          </svg>
                                          Download PDF
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
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
        <section className="space-y-5">
          {/* ── Medical Records CRM-Style Pipeline List (Horizontal Full-Width) ── */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <header className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-teal/10 text-brand-teal">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-950">Medical Records</h2>
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-black text-slate-700">
                        {medicalAccessAppointments.length}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500">Clinical documentation & encounter history</p>
                  </div>
                </div>
              </div>

              {/* CRM Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-3 border-t border-slate-200/80 mt-3.5 pt-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <div className="col-span-5 sm:col-span-4">Encounter / Doctor</div>
                <div className="col-span-3 sm:col-span-3">Specialty</div>
                <div className="col-span-2 sm:col-span-3">Date &amp; Time</div>
                <div className="col-span-2 sm:col-span-2 text-right">Status</div>
              </div>
            </header>

            {/* CRM List rows */}
            {medicalAccessAppointments.length ? (
              <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                {medicalAccessAppointments.map((booking) => {
                  const selected = selectedMedicalAppointment?.id === booking.id;
                  const doctorProfile = doctors.find((d) => d.id === booking.doctor.id);
                  const initials = getInitials(booking.doctor.name) || "DR";

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => {
                        setSelectedMedicalAppointmentId(booking.id);
                        setMedicalAccessTab("summary");
                      }}
                      className={`group relative w-full text-left transition-all duration-150 ${
                        selected
                          ? "bg-brand-teal/5 text-slate-950"
                          : "hover:bg-slate-50/80 text-slate-700"
                      }`}
                    >
                      {/* CRM Selection Accent Bar */}
                      {selected && (
                        <div className="absolute inset-y-0 left-0 w-1 bg-brand-teal rounded-r" />
                      )}

                      <div className="px-5 py-3 sm:py-3.5 flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-3 sm:items-center">
                        {/* Doctor Avatar & Info */}
                        <div className="sm:col-span-4 flex items-center gap-3 min-w-0">
                          {doctorProfile?.image ? (
                            <Image
                              src={doctorProfile.image}
                              alt={booking.doctor.name}
                              width={36}
                              height={36}
                              unoptimized
                              className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-xs font-black text-brand-teal ring-1 ring-brand-teal/20">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-slate-950 group-hover:text-brand-teal transition-colors">
                              {booking.doctor.name}
                            </p>
                            <p className="truncate text-[11px] text-slate-500 font-medium sm:hidden">
                              {booking.doctor.specialty}
                            </p>
                          </div>
                        </div>

                        {/* Specialty */}
                        <div className="hidden sm:block sm:col-span-3 min-w-0">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                            {booking.doctor.specialty}
                          </span>
                        </div>

                        {/* Date & Time */}
                        <div className="sm:col-span-3 flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-800">{formatAppointmentFeedDate(booking.scheduledAt)}</span>
                          <span className="text-slate-400 font-medium">·</span>
                          <span className="font-semibold text-slate-500">{formatAppointmentFeedTime(booking.scheduledAt)}</span>
                        </div>

                        {/* Status Badge */}
                        <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2 shrink-0">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${getAppointmentStatusStyle(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8">
                <EmptyState title="No medical records yet" body="Completed consultations and doctor documentation appear here." />
              </div>
            )}
          </section>

          {/* ── Encounter Detail & Documents Section (Below Medical Records) ── */}
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadTranscriptReport(selectedMedicalAppointment, patient)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal/40 bg-teal-50 px-3.5 py-3 text-xs font-black text-brand-teal hover:bg-teal-100 transition shadow-2xs"
                        title="Download consultation speech transcript as PDF"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Download Transcript PDF
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadMedicalReport(selectedMedicalAppointment, patient)}
                        className="rounded-lg bg-slate-950 px-4 py-3 text-xs font-black text-white hover:bg-slate-800 transition"
                      >
                        Download PDF Report
                      </button>
                    </div>
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
                    <section className="space-y-4">
                      {/* Primary stats row */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                          { label: "Chief Complaint", value: selectedMedicalAppointment.reason || "Not recorded.", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, color: "text-brand-red bg-red-50 border-red-100" },
                          { label: "Duration", value: `${selectedMedicalAppointment.duration || DEFAULT_DURATION_MINUTES} min`, icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, color: "text-brand-teal bg-teal-50 border-teal-100" },
                          { label: "Status", value: selectedMedicalAppointment.status, icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                          { label: "Encounter Type", value: "Teleconsultation", icon: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>, color: "text-violet-600 bg-violet-50 border-violet-100" },
                        ].map((item) => (
                          <div key={item.label} className={`rounded-xl border p-4 ${item.color}`}>
                            <div className="flex items-center gap-2 opacity-70">{item.icon}<p className="text-[10px] font-black uppercase tracking-wider">{item.label}</p></div>
                            <p className="mt-2 text-sm font-black leading-snug">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Provider & Patient info */}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Attending Physician</p>
                          <div className="flex items-center gap-3">
                            {(() => { const doc = doctors.find((d) => d.id === selectedMedicalAppointment.doctor.id); return doc?.image ? <Image src={doc.image} alt={doc.name} width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-sm font-black text-brand-teal">{getInitials(selectedMedicalAppointment.doctor.name) || "DR"}</div>; })()}
                            <div className="min-w-0">
                              <p className="font-black text-slate-950 text-sm truncate">{selectedMedicalAppointment.doctor.name}</p>
                              <p className="text-xs font-semibold text-brand-teal truncate">{selectedMedicalAppointment.doctor.specialty}</p>
                              {selectedMedicalAppointment.doctor.licenseNumber && <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">License: {selectedMedicalAppointment.doctor.licenseNumber}</p>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Date</p>
                              <p className="mt-1 text-xs font-black text-slate-900">{formatAppointmentFeedDate(selectedMedicalAppointment.scheduledAt)}</p>
                            </div>
                            <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Time</p>
                              <p className="mt-1 text-xs font-black text-slate-900">{formatAppointmentFeedTime(selectedMedicalAppointment.scheduledAt)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Patient Profile</p>
                          <div className="space-y-2">
                            {[
                              { label: "Full Name", value: `${patient.firstName} ${patient.lastName}`.trim() || "Not specified" },
                              { label: "Patient ID", value: `#${patient.id.slice(-8).toUpperCase()}` },
                              { label: "Blood Type", value: patient.bloodType || "Not on file" },
                              { label: "Phone", value: patient.phone || "Not on file" },
                            ].map((r) => (
                              <div key={r.label} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-slate-100 px-3 py-2">
                                <span className="text-[11px] font-bold text-slate-400">{r.label}</span>
                                <span className="text-[11px] font-black text-slate-900 text-right">{r.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Vitals snapshot */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal mb-3">Vitals at Encounter</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {[
                            { label: "Blood Pressure", value: latestVitals.bloodPressure || "Not recorded", icon: "🩺" },
                            { label: "Heart Rate", value: latestVitals.heartRate ? `${latestVitals.heartRate} bpm` : "Not recorded", icon: "❤️" },
                            { label: "Temperature", value: latestVitals.bodyTemperature ? `${latestVitals.bodyTemperature}°C` : "Not recorded", icon: "🌡️" },
                          ].map((v) => (
                            <div key={v.label} className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 flex items-center gap-2.5">
                              <span className="text-lg leading-none">{v.icon}</span>
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{v.label}</p>
                                <p className="mt-0.5 text-xs font-black text-slate-900">{v.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Allergies & Conditions */}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 mb-2">Known Allergies</p>
                          <p className="text-sm font-bold text-amber-900 leading-relaxed">{patientMedicalSummary.allergies || "None on file"}</p>
                        </div>
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-2">Active Conditions</p>
                          <p className="text-sm font-bold text-blue-900 leading-relaxed">{patientMedicalSummary.conditions || "None documented"}</p>
                        </div>
                      </div>
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

                  {medicalAccessTab === "certificates" && (
                    <section className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Official Medical Certificate</p>
                            <h3 className="text-sm font-black text-slate-950">Doctor-Issued Certificate</h3>
                          </div>
                        </div>
                        {(() => {
                          const certsForAppt = [...(patient.medicalCertificates || [])]
                            .filter(
                              (c) => c.consultationId === selectedMedicalAppointment.id || c.doctor?.id === selectedMedicalAppointment.doctor.id
                            )
                            .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
                          if (certsForAppt.length === 0) {
                            return (
                              <div className="rounded-lg bg-white border border-slate-200 p-5 text-center">
                                <p className="text-sm font-black text-slate-500">No medical certificate issued</p>
                                <p className="mt-1 text-xs font-semibold text-slate-400">
                                  No medical certificate has been issued for this encounter. Ask your doctor if you need one.
                                </p>
                              </div>
                            );
                          }
                          return certsForAppt.map((cert) => (
                            <div key={cert.id} className="rounded-lg border border-teal-200/80 bg-white p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-black text-brand-teal border border-teal-200">
                                      {cert.certNumber}
                                    </span>
                                    <span className="text-xs font-black text-slate-800">
                                      {cert.purpose === "sick_leave" ? "Sick Leave / Medical Rest"
                                        : cert.purpose === "fitness_to_work" ? "Fitness to Return to Work"
                                        : cert.purpose === "school" ? "Academic / School Purpose"
                                        : "Medical Certificate"}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] text-slate-500">Issued: {formatDate(cert.issuedAt)} · Dr. {cert.doctor.name}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => previewPatientCertPdf(cert, patient, setPreviewMedicalDoc)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 transition"
                                  >
                                    <svg className="h-3.5 w-3.5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    Preview
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadPatientCertPdf(cert, patient)}
                                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-teal px-3 py-2 text-xs font-black text-white hover:bg-teal-600 transition"
                                  >
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                      <polyline points="7 10 12 15 17 10" />
                                      <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Download PDF
                                  </button>
                                </div>
                              </div>
                              {cert.diagnosis && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Diagnosis / Condition</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-700">{cert.diagnosis}</p>
                                </div>
                              )}
                              {(cert.restDaysFrom || cert.restDaysTo) && (
                                <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Leave Period</p>
                                  <p className="mt-1 text-xs font-black text-teal-900">
                                    {cert.restDaysFrom ? formatDate(cert.restDaysFrom) : "—"} &ndash; {cert.restDaysTo ? formatDate(cert.restDaysTo) : "—"}
                                  </p>
                                </div>
                              )}
                              {cert.remarks && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Remarks</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-700">{cert.remarks}</p>
                                </div>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </section>
                  )}

                  {medicalAccessTab === "transcript" && (
                    <section className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Synchronous Audio Transcript</p>
                            <h3 className="text-sm font-black text-slate-950">Consultation Dialogue & Clinical Record</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => downloadTranscriptReport(selectedMedicalAppointment, patient)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-teal px-3.5 py-2 text-xs font-black text-white hover:bg-teal-600 transition shadow-xs shrink-0"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download Transcript (.PDF)
                          </button>
                        </div>

                        {/* Dialogue Stream Container */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 max-h-96 overflow-y-auto">
                          <div className="rounded-lg bg-teal-50/60 border border-teal-200/60 p-3 space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Verified Audio Session</p>
                            <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                              This transcript was automatically transcribed from the synchronous audiovisual teleconsultation between Dr. {selectedMedicalAppointment.doctor.name} and {patient?.firstName || "Patient"}.
                            </p>
                          </div>

                          {(() => {
                            const { clinicalNotes: cleanNotes, transcriptTurns: turnsFromNotes } = parseNotesAndTranscript(selectedMedicalAppointment.notes);
                            let turns = turnsFromNotes;
                            if (turns.length === 0 && typeof window !== "undefined") {
                              try {
                                const saved = localStorage.getItem(`healthko:transcript:${selectedMedicalAppointment.id}`);
                                if (saved) {
                                  const parsed = JSON.parse(saved);
                                  if (Array.isArray(parsed) && parsed.length > 0) turns = parsed;
                                }
                              } catch {}
                            }

                            if (turns.length === 0) {
                              return (
                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-center space-y-2">
                                  <p className="text-xs font-bold text-slate-700">
                                    No live spoken conversation dialogue was captured for this encounter.
                                  </p>
                                  <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                                    Official clinical observations, assessment directives, and care directives recorded by your physician are detailed below.
                                  </p>
                                  {cleanNotes && (
                                    <div className="mt-3 text-left rounded-lg bg-white border border-slate-200 p-3">
                                      <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal mb-1">Doctor&apos;s Medical Note</p>
                                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{cleanNotes}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2.5 pt-2">
                                {turns.map((turn, idx) => {
                                  const isDoctor = turn.role === "doctor" || turn.speaker.toLowerCase().includes("dr");
                                  return (
                                    <div
                                      key={turn.id || idx}
                                      className={`rounded-xl border p-3 space-y-1 ${
                                        isDoctor
                                          ? "border-teal-100 bg-teal-50/40"
                                          : "border-slate-200 bg-slate-50/60"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className={`text-xs font-black ${isDoctor ? "text-brand-teal" : "text-slate-800"}`}>
                                          [{turn.timestamp || "00:00"}] {turn.speaker}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400">
                                          {isDoctor ? "Attending Physician" : "Patient"}
                                        </span>
                                      </div>
                                      <p className="text-xs font-medium text-slate-800 leading-relaxed">
                                        {turn.text}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
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
          items={prescriptions.map((booking) => {
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
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-black text-slate-950">{doctor.name}</p>
                    {doctor.isVerified && (
                      <span title="Verified Doctor" className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-brand-teal">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                          <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-bold text-brand-teal">{doctor.specialty}</p>
                </div>
                {doctor.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-black uppercase text-teal-800">
                    <svg className="h-3 w-3 text-brand-teal" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2 3 7v6c0 5 4 9 9 9s9-4 9-9V7z" />
                      <path d="m9 12 2 2 4-4" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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

      <ConcurrentLoginModal
        isOpen={concurrentSession.isOpen}
        role="patient"
        newDevice={concurrentSession.newDevice}
        loginTime={concurrentSession.loginTime}
        onLogout={() => void logoutPatient()}
      />

      <ActiveCallWarningModal
        isOpen={showWarningModal}
        onClose={closeWarningModal}
        onEndCall={() => {
          session.endSession(true);
          setActiveModule("overview");
        }}
      />

      {/* ── Manage Appointments Modal ── */}
      {manageAppointmentsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-appts-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) { setManageAppointmentsOpen(false); setManageApptSelected(null); setManageApptAction("idle"); } }}
        >
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-brand-teal/10 via-slate-50 to-white p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal text-white shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <p id="manage-appts-modal-title" className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Online Consultation</p>
                  <h2 className="text-lg font-black text-slate-950">{manageApptSelected && manageApptAction !== "idle" ? (manageApptAction === "cancel" ? "Cancel Appointment" : manageApptAction === "reschedule-sent" ? "Reschedule Requested" : "Reschedule Appointment") : "Manage Appointments"}</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setManageAppointmentsOpen(false); setManageApptSelected(null); setManageApptAction("idle"); }}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* List view */}
              {(!manageApptSelected || manageApptAction === "idle") && (() => {
                const activeAppts = appointments.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED");
                return (
                  <div>
                    {activeAppts.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
                          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </div>
                        <p className="text-sm font-black text-slate-500">No Active Appointments</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">All your pending and confirmed appointments will appear here.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {activeAppts.map((appt) => (
                          <button
                            key={appt.id}
                            type="button"
                            onClick={() => { setManageApptSelected(appt); setManageApptAction("idle"); }}
                            className={`w-full px-5 py-4 text-left hover:bg-slate-50 transition ${manageApptSelected?.id === appt.id ? "bg-teal-50/60" : ""}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-sm font-black text-brand-teal">
                                {getInitials(appt.doctor.name) || "DR"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-950 text-sm truncate">{appt.doctor.name}</p>
                                <p className="text-xs font-semibold text-slate-500 truncate">{appt.doctor.specialty}</p>
                                <p className="mt-0.5 text-[11px] font-medium text-slate-400">{formatAppointmentFeedDate(appt.scheduledAt)} · {formatAppointmentFeedTime(appt.scheduledAt)}</p>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${getAppointmentStatusStyle(appt.status)}`}>{appt.status}</span>
                                <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Detail / action panel for selected appointment */}
              {manageApptSelected && manageApptAction === "idle" && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Selected Appointment</p>
                      <p className="mt-1 text-base font-black text-slate-950">{manageApptSelected.doctor.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{manageApptSelected.doctor.specialty}</p>
                      <p className="mt-1 text-xs font-medium text-slate-400">{formatAppointmentFeedDate(manageApptSelected.scheduledAt)} · {formatAppointmentFeedTime(manageApptSelected.scheduledAt)}</p>
                    </div>
                    <button type="button" onClick={() => setManageApptSelected(null)} className="text-[11px] font-bold text-slate-400 hover:text-brand-teal transition">← Back</button>
                  </div>
                  {manageApptSelected.reason && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Reason for Visit</p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{manageApptSelected.reason}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setManageApptAction("reschedule")}
                      className="flex-1 rounded-xl border border-brand-teal bg-teal-50 px-4 py-3 text-xs font-black text-brand-teal hover:bg-teal-100 transition"
                    >
                      <svg viewBox="0 0 24 24" className="mx-auto mb-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageApptAction("cancel")}
                      className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-brand-red hover:bg-red-100 transition"
                    >
                      <svg viewBox="0 0 24 24" className="mx-auto mb-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel confirmation */}
              {manageApptSelected && manageApptAction === "cancel" && (
                <div className="border-t border-slate-100 p-5 space-y-4">
                  <button type="button" onClick={() => setManageApptAction("idle")} className="text-[11px] font-bold text-slate-400 hover:text-brand-teal transition">← Back</button>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-black text-brand-red">Cancel this appointment?</p>
                    <p className="mt-1.5 text-xs font-medium text-red-700 leading-relaxed">You are about to cancel your consultation with <strong>{manageApptSelected.doctor.name}</strong> on {formatAppointmentFeedDate(manageApptSelected.scheduledAt)} at {formatAppointmentFeedTime(manageApptSelected.scheduledAt)}. This action cannot be undone.</p>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setManageApptAction("idle")} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 hover:bg-slate-50 transition">Keep Appointment</button>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          try {
                            await fetch(`/api/appointments/${manageApptSelected.id}/cancel`, { method: "POST" });
                          } catch {/* silent */}
                          setManageAppointmentsOpen(false);
                          setManageApptSelected(null);
                          setManageApptAction("idle");
                          showToast("success", "Appointment cancelled successfully.");
                        })();
                      }}
                      className="flex-1 rounded-xl bg-brand-red px-4 py-3 text-xs font-black text-white hover:opacity-90 transition"
                    >Confirm Cancellation</button>
                  </div>
                </div>
              )}

              {/* Reschedule form */}
              {manageApptSelected && manageApptAction === "reschedule" && (
                <div className="border-t border-slate-100 p-5 space-y-4">
                  <button type="button" onClick={() => setManageApptAction("idle")} className="text-[11px] font-bold text-slate-400 hover:text-brand-teal transition">← Back</button>
                  <div className="rounded-xl border border-brand-teal/20 bg-teal-50/40 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal mb-1">Request Reschedule</p>
                    <p className="text-xs font-medium text-slate-600 leading-relaxed">Choose a preferred new date and time. Your request will be sent to <strong>{manageApptSelected.doctor.name}</strong> for approval.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="manage-reschedule-date">Preferred Date</label>
                      <input
                        id="manage-reschedule-date"
                        type="date"
                        value={manageApptReschedDate}
                        onChange={(e) => setManageApptReschedDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="manage-reschedule-time">Preferred Time</label>
                      <input
                        id="manage-reschedule-time"
                        type="time"
                        value={manageApptReschedTime}
                        onChange={(e) => setManageApptReschedTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1">Pending Doctor Approval</p>
                    <p className="text-xs font-medium text-amber-800">Reschedule requests require your doctor&apos;s confirmation before taking effect. You will be notified once the new schedule is approved.</p>
                  </div>
                  <button
                    type="button"
                    disabled={!manageApptReschedDate || !manageApptReschedTime}
                    onClick={() => {
                      void (async () => {
                        try {
                          await fetch(`/api/appointments/${manageApptSelected.id}/reschedule`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ date: manageApptReschedDate, time: manageApptReschedTime }),
                          });
                        } catch {/* silent */}
                        setManageApptAction("reschedule-sent");
                        setManageApptReschedDate("");
                        setManageApptReschedTime("");
                      })();
                    }}
                    className="w-full rounded-xl bg-brand-teal px-4 py-3 text-xs font-black text-white hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >Send Reschedule Request</button>
                </div>
              )}

              {/* Reschedule sent confirmation */}
              {manageApptSelected && manageApptAction === "reschedule-sent" && (
                <div className="p-8 text-center space-y-3">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-brand-teal">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <p className="text-base font-black text-slate-950">Reschedule Request Sent</p>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-xs mx-auto">Your reschedule request has been submitted to <strong>{manageApptSelected.doctor.name}</strong>. You will be notified once it is approved or declined.</p>
                  <button
                    type="button"
                    onClick={() => { setManageAppointmentsOpen(false); setManageApptSelected(null); setManageApptAction("idle"); }}
                    className="mt-2 rounded-xl bg-brand-teal px-6 py-3 text-xs font-black text-white hover:bg-teal-600 transition"
                  >Done</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Medical Record Details & Documents Modal ── */}
      {medicalRecordModalAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medical-record-modal-title"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-teal-500/10 via-slate-50 to-white p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-teal text-white shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                      Completed Encounter
                    </span>
                    <span className="text-xs font-bold text-slate-400">·</span>
                    <span className="text-xs font-bold text-slate-500">
                      {formatDateTime(medicalRecordModalAppointment.scheduledAt)}
                    </span>
                  </div>
                  <h2 id="medical-record-modal-title" className="text-lg font-black text-slate-950 sm:text-xl">
                    Medical Record &amp; Consultation Summary
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMedicalRecordModalAppointment(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
              {/* Doctor & Encounter Overview */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Attending Physician</p>
                  <div className="mt-2 flex items-center gap-3">
                    {doctors.find((d) => d.id === medicalRecordModalAppointment.doctor.id)?.image ? (
                      <Image
                        src={doctors.find((d) => d.id === medicalRecordModalAppointment.doctor.id)!.image!}
                        alt={medicalRecordModalAppointment.doctor.name}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-xs font-black text-brand-teal">
                        {getInitials(medicalRecordModalAppointment.doctor.name) || "DR"}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-black text-slate-950">{medicalRecordModalAppointment.doctor.name}</p>
                      <p className="text-xs font-semibold text-brand-teal">{medicalRecordModalAppointment.doctor.specialty}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-brand-teal">Reason for Visit / Complaint</p>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-800">
                    {medicalRecordModalAppointment.reason || "General medical consultation and clinical evaluation."}
                  </p>
                </div>
              </div>

              {/* Clinical Notes & Doctor Assessment */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-teal-50 text-brand-teal">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Doctor&apos;s Assessment &amp; Clinical Notes</h3>
                </div>
                <div className="mt-3 text-xs leading-relaxed text-slate-700">
                  {medicalRecordModalAppointment.notes ? (
                    <ul className="space-y-2">
                      {getMedicalBullets(medicalRecordModalAppointment.notes).map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 font-medium text-slate-800">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-medium text-slate-500 italic">No specific clinical notes were recorded for this encounter.</p>
                  )}
                </div>
              </div>

              {/* Prescription Section if available */}
              {medicalRecordModalAppointment.prescription && (
                <div className="rounded-xl border border-teal-200/80 bg-teal-50/40 p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-teal-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-md bg-brand-teal text-white">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-teal-950">Prescription Details (E-Signed)</h3>
                    </div>
                    <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-black text-teal-800">
                      Rx Approved
                    </span>
                  </div>
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-teal-100 bg-white p-3.5 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {medicalRecordModalAppointment.prescription}
                  </div>
                </div>
              )}

              {/* Downloadable Documents Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">Available Documents to Download</h3>
                    <p className="text-[11px] font-medium text-slate-500">Official medical records, PDFs, and certificates issued for this encounter</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Document 1: Full Consultation Report */}
                  {/* Document 1: Consultation Report PDF */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-teal/50 hover:bg-white hover:shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-2xs">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-950">Consultation Report</p>
                        <p className="text-[10px] font-semibold text-slate-500">PDF · Assessment &amp; Clinical Summary</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => previewFullConsultationReport(medicalRecordModalAppointment, patient, setPreviewMedicalDoc)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs transition"
                      >
                        <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadFullConsultationReport(medicalRecordModalAppointment, patient)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-black text-white hover:bg-slate-800 shadow-2xs transition"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </button>
                    </div>
                  </div>

                  {/* Document 2: Official Prescription PDF */}
                  {medicalRecordModalAppointment.prescription ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50/50 p-4 transition hover:border-purple-300 hover:bg-white hover:shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-700 text-white shadow-2xs">
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-black text-purple-950">Official E-Prescription</p>
                          <p className="text-[10px] font-semibold text-purple-700">PDF · E-Signed &amp; Compliant</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => previewMedicalReport(medicalRecordModalAppointment, patient, setPreviewMedicalDoc)}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-50 shadow-2xs transition"
                        >
                          <svg className="h-3.5 w-3.5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadMedicalReport(medicalRecordModalAppointment, patient)}
                          className="inline-flex items-center gap-1 rounded-lg bg-purple-700 px-2.5 py-1.5 text-xs font-black text-white hover:bg-purple-800 shadow-2xs transition"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Document 3: Medical Certificates */}
                  {(() => {
                    const cert = (patient.medicalCertificates || []).find(
                      (c) => c.consultationId === medicalRecordModalAppointment.id || c.doctor?.id === medicalRecordModalAppointment.doctor.id
                    );
                    if (!cert) return null;

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4 transition hover:border-brand-teal hover:bg-white hover:shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-teal text-white shadow-2xs">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              <path d="m9 12 2 2 4-4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-black text-teal-950">Medical Certificate</p>
                            <p className="text-[10px] font-semibold text-teal-700">{cert.certNumber} · {cert.purpose === "sick_leave" ? "Sick Leave" : "Clearance"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => previewPatientCertPdf(cert, patient, setPreviewMedicalDoc)}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50 shadow-2xs transition"
                          >
                            <svg className="h-3.5 w-3.5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPatientCertPdf(cert, patient)}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-teal px-2.5 py-1.5 text-xs font-black text-white hover:bg-teal-600 shadow-2xs transition"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Document 4: Consultation Transcript */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-teal/50 hover:bg-white hover:shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800 text-white group-hover:bg-brand-teal transition-colors shadow-2xs">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-950">Call Transcript PDF</p>
                        <p className="text-[10px] font-semibold text-slate-500">PDF · Speech-to-text transcript</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => previewTranscriptReport(medicalRecordModalAppointment, patient, setPreviewMedicalDoc)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs transition"
                      >
                        <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTranscriptReport(medicalRecordModalAppointment, patient)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-black text-white hover:bg-slate-800 shadow-2xs transition"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6">
              <button
                type="button"
                onClick={() => {
                  setSelectedMedicalAppointmentId(medicalRecordModalAppointment.id);
                  setActiveModule("history");
                  setMedicalRecordModalAppointment(null);
                }}
                className="text-xs font-bold text-slate-600 hover:text-brand-teal transition underline underline-offset-2"
              >
                Open full Medical Access timeline &rarr;
              </button>
              <button
                type="button"
                onClick={() => setMedicalRecordModalAppointment(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medical Document Preview Modal */}
      {previewMedicalDoc && (
        <MedicalFilePreviewModal
          doc={previewMedicalDoc}
          onClose={() => setPreviewMedicalDoc(null)}
        />
      )}
    </DashboardShell>
  );
}


