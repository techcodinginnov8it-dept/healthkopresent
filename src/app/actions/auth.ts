"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Seed data helper to ensure demo doctors exist in Supabase
async function ensureFeaturedDoctorsSeeded() {
  const doctorCount = await prisma.doctor.count();
  if (doctorCount === 0) {
    const defaultDoctors = [
      {
        npi: "1982736450",
        email: "s.jenkins@healthko.com",
        password: await bcrypt.hash("doctor123", 10),
        name: "Dr. Sarah Jenkins",
        specialty: "Board-Certified Cardiologist",
        rating: 4.9,
        availability: "Mon - Fri, 9AM - 5PM"
      },
      {
        npi: "1098273645",
        email: "m.vance@healthko.com",
        password: await bcrypt.hash("doctor123", 10),
        name: "Dr. Marcus Vance",
        specialty: "Pediatric Medicine Specialist",
        rating: 4.8,
        availability: "Mon - Thu, 8AM - 4PM"
      },
      {
        npi: "1234567890",
        email: "a.patel@healthko.com",
        password: await bcrypt.hash("doctor123", 10),
        name: "Dr. Aaliyah Patel",
        specialty: "Family Practitioner & Telehealth Lead",
        rating: 4.9,
        availability: "Tue - Sat, 10AM - 6PM"
      }
    ];

    for (const doc of defaultDoctors) {
      await prisma.doctor.create({ data: doc });
    }
  }
}

/**
 * Register a new patient in Supabase
 */
export async function registerPatient(data: any) {
  try {
    const { firstName, middleName, lastName, suffix, email, countryCode, phone, dob, password, hipaaConsent } = data;

    if (!firstName || !lastName || !email || !phone || !dob || !password) {
      return { success: false, error: "Missing required fields" };
    }

    // Check email uniqueness
    const existingPatient = await prisma.patient.findUnique({
      where: { email }
    });

    if (existingPatient) {
      return { success: false, error: "A patient with this email already exists" };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save record
    const patient = await prisma.patient.create({
      data: {
        firstName,
        middleName: middleName || null,
        lastName,
        suffix: suffix || null,
        email,
        countryCode,
        phone,
        dob,
        password: hashedPassword,
        hipaaConsent
      }
    });

    return {
      success: true,
      patient: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName}`,
        email: patient.email
      }
    };
  } catch (error: any) {
    console.error("Registration Error:", error);
    return { success: false, error: error.message || "Database synchronization failed" };
  }
}

/**
 * Authenticate patient credentials
 */
export async function loginPatient(data: any) {
  try {
    const { email, password } = data;

    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    const patient = await prisma.patient.findUnique({
      where: { email }
    });

    if (!patient) {
      return { success: false, error: "Invalid email or password" };
    }

    const isMatch = await bcrypt.compare(password, patient.password);
    if (!isMatch) {
      return { success: false, error: "Invalid email or password" };
    }

    return {
      success: true,
      user: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName}`,
        email: patient.email
      }
    };
  } catch (error: any) {
    console.error("Patient Login Error:", error);
    return { success: false, error: error.message || "Authentication failed" };
  }
}

/**
 * Authenticate doctor credentials (NPI or Email)
 */
export async function loginDoctor(data: any) {
  try {
    const { emailOrNpi, password, securityKey } = data;

    if (!emailOrNpi || !password) {
      return { success: false, error: "NPI/Email and password are required" };
    }

    // Ensure our doctor seeds are loaded
    await ensureFeaturedDoctorsSeeded();

    // Query either NPI or email
    const doctor = await prisma.doctor.findFirst({
      where: {
        OR: [
          { email: emailOrNpi },
          { npi: emailOrNpi }
        ]
      }
    });

    if (!doctor) {
      return { success: false, error: "No physician matches these credentials" };
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return { success: false, error: "Invalid credentials" };
    }

    // Verify 6-digit passcode check (simulation)
    if (securityKey && securityKey.length !== 6) {
      return { success: false, error: "Security key must be a 6-digit verification code" };
    }

    return {
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty
      }
    };
  } catch (error: any) {
    console.error("Doctor Login Error:", error);
    return { success: false, error: error.message || "Licensure lookup failed" };
  }
}
