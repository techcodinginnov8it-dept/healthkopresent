export type DashboardRole = "patient" | "doctor";

export type PatientModuleId =
  | "overview"
  | "book"
  | "live"
  | "history"
  | "prescriptions"
  | "doctors"
  | "messages"
  | "notifications"
  | "billing"
  | "settings";

export type DoctorModuleId =
  | "overview"
  | "live"
  | "patients"
  | "schedule"
  | "notes"
  | "prescriptions"
  | "messages"
  | "notifications"
  | "analytics"
  | "settings";

export type ModuleId = PatientModuleId | DoctorModuleId;

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | string;

export type DashboardDoctor = {
  id: string;
  name: string;
  email?: string;
  npi?: string;
  specialty: string;
  availability: string;
  consultFee?: number | null;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
};

export type DashboardPatient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode?: string;
  dob: string;
  gender: string | null;
  emailVerified: boolean;
};

export type PatientAppointment = {
  id: string;
  scheduledAt: Date | string;
  status: AppointmentStatus;
  reason: string | null;
  duration: number | null;
  prescription: string | null;
  notes?: string | null;
  createdAt: Date | string;
  doctor: {
    name: string;
    specialty: string;
  };
};

export type DoctorAppointment = {
  id: string;
  scheduledAt: Date | string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  prescription: string | null;
  duration: number | null;
  createdAt: Date | string;
  patient: DashboardPatient;
};

export type RealtimeEvent =
  | {
      type: "appointment:created" | "appointment:updated";
      appointmentId: string;
      actorRole: DashboardRole;
    }
  | {
      type: "session:joined" | "session:ended" | "session:reconnected";
      appointmentId: string;
      actorRole: DashboardRole;
    }
  | {
      type: "message:new";
      appointmentId: string;
      actorRole: DashboardRole;
      text: string;
    }
  | {
      type: "notification:new";
      actorRole: DashboardRole;
      title: string;
      body: string;
    };

export type ChatMessage = {
  id: string;
  sender: DashboardRole;
  text: string;
  time: string;
};
