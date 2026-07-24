import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const DB_PATH = path.join(process.cwd(), "src/lib/mock-db.json");

export type MockPatient = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string;
  image?: string | null;
  countryCode: string;
  phone: string;
  dob: string;
  gender: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  height?: string | null;
  weight?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  existingConditions?: string | null;
  currentMedications?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  password: string;
  hipaaConsent: boolean;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MockDoctor = {
  id: string;
  name: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  npi: string;
  email: string;
  password: string;
  specialty: string;
  bio: string | null;
  image: string | null;
  languages: string[];
  rating: number;
  reviewCount: number;
  availability: string;
  status?: string | null;
  consultFee: number | null;
  consultationDuration?: number | null;
  consultationDurationUnit?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  yearsExp?: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MockConsultation = {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  reason: string | null;
  notes: string | null;
  prescription: string | null;
  duration: number;
  createdAt: string;
  updatedAt: string;
};

export type MockEmailOtp = {
  id: string;
  email: string;
  otp: string;
  purpose: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
};

export type MockVideoSession = {
  id: string;
  consultationId: string;
  status: "WAITING" | "STARTED" | "ENDED";
  roomId: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MockDoctorAudit = {
  id: string;
  doctorId: string | null;
  npi: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  documentName: string | null;
  approvalType: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  signature: string;
  consent: boolean;
  doctorEmail?: string | null;
  submittedAt: string;
  updatedAt: string;
};

type MockDbSchema = {
  patients: MockPatient[];
  doctors: MockDoctor[];
  consultations: MockConsultation[];
  emailOtps: MockEmailOtp[];
  videoSessions?: MockVideoSession[];
  audits?: MockDoctorAudit[];
};

function getDb(): MockDbSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Seed data if database file does not exist
      const initialDb: MockDbSchema = {
        patients: [],
        doctors: [],
        consultations: [],
        emailOtps: [],
        videoSessions: [],
        audits: [],
      };

      fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), "utf8");
      return initialDb;
    }

    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as MockDbSchema;
    parsed.videoSessions ||= [];
    parsed.audits ||= [];
    return parsed;
  } catch (error) {
    console.error("Error reading mock database, using empty state:", error);
    return { patients: [], doctors: [], consultations: [], emailOtps: [], videoSessions: [], audits: [] };
  }
}

function saveDb(db: MockDbSchema) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing mock database to file:", error);
  }
}

export const mockDb = {
  // --- Patients ---
  findPatientByEmail(email: string): MockPatient | null {
    const db = getDb();
    return db.patients.find((p) => p.email.toLowerCase() === email.toLowerCase()) || null;
  },

  findPatientById(id: string): MockPatient | null {
    const db = getDb();
    return db.patients.find((p) => p.id === id) || null;
  },

  createPatient(data: Omit<MockPatient, "id" | "createdAt" | "updatedAt" | "isActive">): MockPatient {
    const db = getDb();
    const newPatient: MockPatient = {
      ...data,
      id: "pat-" + Math.random().toString(36).substr(2, 9),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.patients.push(newPatient);
    saveDb(db);
    return newPatient;
  },

  deletePatient(email: string): boolean {
    const db = getDb();
    const index = db.patients.findIndex((p) => p.email.toLowerCase() === email.toLowerCase());
    if (index === -1) return false;
    db.patients.splice(index, 1);
    saveDb(db);
    return true;
  },

  updatePatient(email: string, data: Partial<MockPatient>): MockPatient | null {
    const db = getDb();
    const patientIndex = db.patients.findIndex((p) => p.email.toLowerCase() === email.toLowerCase());
    if (patientIndex === -1) return null;

    db.patients[patientIndex] = {
      ...db.patients[patientIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.patients[patientIndex];
  },

  updatePatientById(id: string, data: Partial<MockPatient>): MockPatient | null {
    const db = getDb();
    const patientIndex = db.patients.findIndex((p) => p.id === id);
    if (patientIndex === -1) return null;

    db.patients[patientIndex] = {
      ...db.patients[patientIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.patients[patientIndex];
  },

  // --- Doctors ---
  findDoctorByEmailOrNpi(emailOrNpi: string): MockDoctor | null {
    const db = getDb();
    const cleanValue = emailOrNpi.toLowerCase();
    return db.doctors.find(
      (d) => d.email.toLowerCase() === cleanValue || d.npi === emailOrNpi
    ) || null;
  },

  findDoctorById(id: string): MockDoctor | null {
    const db = getDb();
    return db.doctors.find((d) => d.id === id) || null;
  },

  createDoctor(
    data: Pick<MockDoctor, "name" | "npi" | "email" | "password" | "specialty"> &
      Partial<Omit<MockDoctor, "id" | "createdAt" | "updatedAt" | "rating" | "reviewCount" | "availability">>
  ): MockDoctor {
    const db = getDb();
    const now = new Date().toISOString();
    const newDoctor: MockDoctor = {
      id: "doc-" + Math.random().toString(36).substr(2, 9),
      name: data.name,
      firstName: data.firstName ?? null,
      middleName: data.middleName ?? null,
      lastName: data.lastName ?? null,
      suffix: data.suffix ?? null,
      npi: data.npi,
      email: data.email,
      password: data.password,
      specialty: data.specialty,
      bio: data.bio ?? null,
      image: data.image ?? null,
      languages: data.languages ?? ["English"],
      rating: 5.0,
      reviewCount: 1,
      availability: "Available Today",
      status: data.status ?? "ONLINE",
      consultFee: data.consultFee ?? 500,
      consultationDuration: data.consultationDuration ?? 30,
      consultationDurationUnit: data.consultationDurationUnit ?? "minutes",
      licenseNumber: data.licenseNumber ?? null,
      licenseState: data.licenseState ?? null,
      yearsExp: data.yearsExp ?? null,
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
      isVerified: data.isVerified ?? true,
      createdAt: now,
      updatedAt: now,
    };
    db.doctors.push(newDoctor);
    saveDb(db);
    return newDoctor;
  },

  updateDoctor(id: string, data: Partial<MockDoctor>): MockDoctor | null {
    const db = getDb();
    const doctorIndex = db.doctors.findIndex((d) => d.id === id);
    if (doctorIndex === -1) return null;

    db.doctors[doctorIndex] = {
      ...db.doctors[doctorIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.doctors[doctorIndex];
  },

  createDoctorAudit(data: Omit<MockDoctorAudit, "id" | "submittedAt" | "updatedAt">): MockDoctorAudit {
    const db = getDb();
    db.audits ||= [];

    const now = new Date().toISOString();
    const audit: MockDoctorAudit = {
      ...data,
      id: "audit-" + Math.random().toString(36).substr(2, 9),
      submittedAt: now,
      updatedAt: now,
    };

    db.audits.push(audit);

    if (audit.doctorId) {
      const doctorIndex = db.doctors.findIndex((doctor) => doctor.id === audit.doctorId);
      if (doctorIndex !== -1) {
        const fullName = [
          audit.firstName,
          audit.middleName,
          audit.lastName,
          audit.suffix,
        ]
          .filter((part) => part && part.trim().length > 0)
          .join(" ")
          .trim();
        db.doctors[doctorIndex] = {
          ...db.doctors[doctorIndex],
          firstName: audit.firstName ?? db.doctors[doctorIndex].firstName ?? null,
          middleName: audit.middleName ?? db.doctors[doctorIndex].middleName ?? null,
          lastName: audit.lastName ?? db.doctors[doctorIndex].lastName ?? null,
          suffix: audit.suffix ?? db.doctors[doctorIndex].suffix ?? null,
          name: fullName || db.doctors[doctorIndex].name,
          licenseNumber: audit.licenseNumber,
          licenseState: audit.licenseState,
          yearsExp: audit.yearsExp,
          specialty: audit.specialty,
          isVerified: false,
          updatedAt: now,
        };
      }
    }

    saveDb(db);
    return audit;
  },

  findDoctorAuditById(id: string): MockDoctorAudit | null {
    const db = getDb();
    return db.audits?.find((audit) => audit.id === id) || null;
  },

  updateDoctorAudit(id: string, data: Partial<Omit<MockDoctorAudit, "id" | "submittedAt">>): MockDoctorAudit | null {
    const db = getDb();
    db.audits ||= [];
    const auditIndex = db.audits.findIndex((audit) => audit.id === id);
    if (auditIndex === -1) return null;

    db.audits[auditIndex] = {
      ...db.audits[auditIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    saveDb(db);
    return db.audits[auditIndex];
  },

  getPendingDoctorAudits() {
    const db = getDb();
    db.audits ||= [];

    return db.audits
      .filter((audit) => audit.status === "PENDING")
      .map((audit) => ({
        ...audit,
        doctor: audit.doctorId
          ? (() => {
              const doctor = this.findDoctorById(audit.doctorId as string);
              return doctor
                ? {
                    id: doctor.id,
                    name: doctor.name,
                    email: doctor.email,
                    specialty: doctor.specialty,
                  }
                : null;
            })()
          : null,
      }))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  getAllDoctorAudits() {
    const db = getDb();
    db.audits ||= [];

    return db.audits
      .map((audit) => ({
        ...audit,
        doctor: audit.doctorId
          ? (() => {
              const doctor = this.findDoctorById(audit.doctorId as string);
              return doctor
                ? {
                    id: doctor.id,
                    name: doctor.name,
                    email: doctor.email,
                    specialty: doctor.specialty,
                  }
                : null;
            })()
          : null,
      }))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  getDoctorAuditsForDoctor(doctorId: string) {
    const db = getDb();

    db.audits ||= [];
    return db.audits
      .filter((audit) => audit.doctorId === doctorId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  },

  getDoctorsList(): Omit<MockDoctor, "password">[] {
    const db = getDb();
    return db.doctors
      .filter((d) => d.isActive && d.isVerified)
      .map((doctor) => {
        const rest = { ...doctor } as Partial<MockDoctor>;
        delete rest.password;
        return rest as Omit<MockDoctor, "password">;
      });
  },

  getAdminMetrics() {
    const db = getDb();
    const totalPatients = db.patients.length;
    const totalDoctors = db.doctors.length;
    const activePatients = db.patients.filter((patient) => patient.isActive).length;
    const activeDoctors = db.doctors.filter((doctor) => doctor.isActive).length;
    const onlineDoctors = db.doctors.filter(
      (doctor) => doctor.isActive && doctor.status?.toUpperCase() === "ONLINE"
    ).length;
    const offlineDoctors = db.doctors.filter(
      (doctor) => doctor.isActive && doctor.status?.toUpperCase() !== "ONLINE"
    ).length;
    const totalConsultations = db.consultations.length;

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const countByRange = (records: { createdAt: string }[], from: Date) =>
      records.filter((record) => new Date(record.createdAt) >= from).length;

    const dailyNewPatients = countByRange(db.patients, dayStart);
    const weeklyNewPatients = countByRange(db.patients, weekStart);
    const monthlyNewPatients = countByRange(db.patients, monthStart);

    const dailyNewDoctors = countByRange(db.doctors, dayStart);
    const weeklyNewDoctors = countByRange(db.doctors, weekStart);
    const monthlyNewDoctors = countByRange(db.doctors, monthStart);

    const dailyConsultations = countByRange(db.consultations, dayStart);
    const weeklyConsultations = countByRange(db.consultations, weekStart);
    const monthlyConsultations = countByRange(db.consultations, monthStart);

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
  },

  // --- OTPs ---
  createEmailOtp(email: string, otp: string, purpose: string, expiresAt: Date) {
    const db = getDb();
    // Invalidate existing active OTPs for the same purpose
    db.emailOtps = db.emailOtps.map((record) => {
      if (record.email.toLowerCase() === email.toLowerCase() && record.purpose === purpose) {
        return { ...record, used: true };
      }
      return record;
    });

    const newOtp: MockEmailOtp = {
      id: "otp-" + Math.random().toString(36).substr(2, 9),
      email,
      otp,
      purpose,
      expiresAt: expiresAt.toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    };
    db.emailOtps.push(newOtp);
    saveDb(db);
    return newOtp;
  },

  findLatestOtp(email: string, purpose: string): MockEmailOtp | null {
    const db = getDb();
    const matching = db.emailOtps.filter(
      (record) =>
        record.email.toLowerCase() === email.toLowerCase() &&
        record.purpose === purpose &&
        !record.used
    );
    if (matching.length === 0) return null;
    // Return latest
    return matching[matching.length - 1];
  },

  markOtpAsUsed(id: string) {
    const db = getDb();
    const index = db.emailOtps.findIndex((r) => r.id === id);
    if (index !== -1) {
      db.emailOtps[index].used = true;
      saveDb(db);
    }
  },

  // --- Consultations ---
  getBookingsForPatient(patientId: string) {
    const db = getDb();
    return db.consultations
      .filter((c) => c.patientId === patientId)
      .map((c) => {
        const doctor = this.findDoctorById(c.doctorId);
        const videoSession = db.videoSessions?.find((vs) => vs.consultationId === c.id) || null;
        return {
          ...c,
          scheduledAt: new Date(c.scheduledAt),
          createdAt: new Date(c.createdAt),
          doctor: doctor
            ? {
                id: doctor.id,
                name: doctor.name,
                specialty: doctor.specialty,
              }
            : {
                id: c.doctorId,
                name: "Unknown Doctor",
                specialty: "General Medicine",
              },
          videoSession: videoSession
            ? { roomId: videoSession.roomId, status: videoSession.status }
            : null,
        };
      })
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  },

  getBookingsForDoctor(doctorId: string) {
    const db = getDb();
    return db.consultations
      .filter((c) => c.doctorId === doctorId)
      .map((c) => {
        const patient = this.findPatientById(c.patientId);
        return {
          ...c,
          scheduledAt: new Date(c.scheduledAt),
          createdAt: new Date(c.createdAt),
          patient: patient
            ? {
                id: patient.id,
                firstName: patient.firstName,
                lastName: patient.lastName,
                email: patient.email,
                image: patient.image ?? null,
                phone: patient.phone,
                countryCode: patient.countryCode,
                dob: patient.dob,
                gender: patient.gender,
                address: patient.address ?? null,
                city: patient.city ?? null,
                state: patient.state ?? null,
                zipCode: patient.zipCode ?? null,
                country: patient.country ?? null,
                height: patient.height ?? null,
                weight: patient.weight ?? null,
                bloodType: patient.bloodType ?? null,
                allergies: patient.allergies ?? null,
                existingConditions: patient.existingConditions ?? null,
                currentMedications: patient.currentMedications ?? null,
                emergencyContactName: patient.emergencyContactName ?? null,
                emergencyContactPhone: patient.emergencyContactPhone ?? null,
                emergencyContactRelation: patient.emergencyContactRelation ?? null,
                emailVerified: patient.emailVerified,
              }
            : null,
        };
      })
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  },

  createConsultation(data: {
    patientId: string;
    doctorId: string;
    scheduledAt: Date;
    reason: string;
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
    duration: number;
  }): MockConsultation {
    const db = getDb();
    const newConsultation: MockConsultation = {
      id: "con-" + Math.random().toString(36).substr(2, 9),
      patientId: data.patientId,
      doctorId: data.doctorId,
      scheduledAt: data.scheduledAt.toISOString(),
      status: data.status,
      reason: data.reason,
      notes: null,
      prescription: null,
      duration: data.duration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.consultations.push(newConsultation);
    saveDb(db);
    return newConsultation;
  },

  updateConsultation(id: string, data: Partial<Omit<MockConsultation, "id" | "createdAt">>): MockConsultation | null {
    const db = getDb();
    const index = db.consultations.findIndex((c) => c.id === id);
    if (index === -1) return null;

    db.consultations[index] = {
      ...db.consultations[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.consultations[index];
  },

  startVideoSession(consultationId: string, roomId: string): MockVideoSession {
    const db = getDb();
    db.videoSessions ||= [];
    const now = new Date().toISOString();
    const index = db.videoSessions.findIndex((session) => session.consultationId === consultationId);

    if (index !== -1) {
      db.videoSessions[index] = {
        ...db.videoSessions[index],
        status: "STARTED",
        roomId,
        startedAt: now,
        updatedAt: now,
      };
      saveDb(db);
      return db.videoSessions[index];
    }

    const videoSession: MockVideoSession = {
      id: "vid-" + Math.random().toString(36).substr(2, 9),
      consultationId,
      status: "STARTED",
      roomId,
      startedAt: now,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    db.videoSessions.push(videoSession);
    saveDb(db);
    return videoSession;
  },

  findVideoSessionByConsultation(consultationId: string): MockVideoSession | null {
    const db = getDb();
    return db.videoSessions?.find((session) => session.consultationId === consultationId) || null;
  },

  endVideoSession(consultationId: string): MockVideoSession | null {
    const db = getDb();
    db.videoSessions ||= [];
    const index = db.videoSessions.findIndex((session) => session.consultationId === consultationId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    db.videoSessions[index] = {
      ...db.videoSessions[index],
      status: "ENDED",
      endedAt: now,
      updatedAt: now,
    };
    saveDb(db);
    return db.videoSessions[index];
  },
};
