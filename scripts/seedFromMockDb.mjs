import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const demoAdmin = {
  email: "admin@healthko.com",
  password: "HkAdmin@2026!",
  name: "System Administrator",
  role: "SUPER_ADMIN",
};

async function upsertUserAccount({ email, password, role, emailVerified = false, isActive = true }) {
  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      password,
      role,
      emailVerified,
      isActive,
    },
    update: {
      password,
      role,
      emailVerified,
      isActive,
    },
  });
}

async function seedAdminAccount() {
  const passwordHash = await bcrypt.hash(demoAdmin.password, 10);
  const user = await upsertUserAccount({
    email: demoAdmin.email,
    password: passwordHash,
    role: "ADMIN",
    emailVerified: true,
    isActive: true,
  });

  await prisma.admin.upsert({
    where: { email: demoAdmin.email },
    update: {
      userId: user.id,
      name: demoAdmin.name,
      role: demoAdmin.role,
    },
    create: {
      userId: user.id,
      name: demoAdmin.name,
      email: demoAdmin.email,
      role: demoAdmin.role,
    },
  });
}

async function seedPatientAccount(patient) {
  const user = await upsertUserAccount({
    email: patient.email.toLowerCase(),
    password: patient.password,
    role: "PATIENT",
    emailVerified: patient.emailVerified,
    isActive: patient.isActive,
  });

  await prisma.patient.upsert({
    where: { email: patient.email.toLowerCase() },
    update: {
      userId: user.id,
      firstName: patient.firstName,
      middleName: patient.middleName ?? null,
      lastName: patient.lastName,
      suffix: patient.suffix ?? null,
      email: patient.email.toLowerCase(),
      countryCode: patient.countryCode,
      phone: patient.phone,
      dob: patient.dob,
      gender: patient.gender ?? null,
      password: patient.password,
      hipaaConsent: patient.hipaaConsent,
      emailVerified: patient.emailVerified,
      isActive: patient.isActive,
      image: patient.image ?? null,
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
    },
    create: {
      id: patient.id,
      userId: user.id,
      firstName: patient.firstName,
      middleName: patient.middleName ?? null,
      lastName: patient.lastName,
      suffix: patient.suffix ?? null,
      email: patient.email.toLowerCase(),
      countryCode: patient.countryCode,
      phone: patient.phone,
      dob: patient.dob,
      gender: patient.gender ?? null,
      password: patient.password,
      hipaaConsent: patient.hipaaConsent,
      emailVerified: patient.emailVerified,
      isActive: patient.isActive,
      image: patient.image ?? null,
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
    },
  });
}

async function seedDoctorAccount(doctor) {
  const user = await upsertUserAccount({
    email: doctor.email.toLowerCase(),
    password: doctor.password,
    role: "DOCTOR",
    emailVerified: doctor.isVerified ?? false,
    isActive: doctor.isActive ?? true,
  });

  await prisma.doctor.upsert({
    where: { email: doctor.email.toLowerCase() },
    update: {
      userId: user.id,
      name: doctor.name,
      firstName: doctor.firstName ?? null,
      middleName: doctor.middleName ?? null,
      lastName: doctor.lastName ?? null,
      suffix: doctor.suffix ?? null,
      npi: doctor.npi,
      email: doctor.email.toLowerCase(),
      password: doctor.password,
      specialty: doctor.specialty,
      bio: doctor.bio ?? null,
      image: doctor.image ?? null,
      languages: doctor.languages || ["English"],
      rating: doctor.rating || 0,
      reviewCount: doctor.reviewCount || 0,
      availability: doctor.availability || "",
      status: doctor.status || "ONLINE",
      consultFee: doctor.consultFee ?? null,
      consultationDuration: doctor.consultationDuration || 30,
      consultationDurationUnit: doctor.consultationDurationUnit || "minutes",
      licenseNumber: doctor.licenseNumber ?? null,
      licenseState: doctor.licenseState ?? null,
      yearsExp: doctor.yearsExp ?? null,
      securityKey: doctor.securityKey ?? null,
      isActive: doctor.isActive ?? true,
      isFeatured: doctor.isFeatured ?? false,
      isVerified: doctor.isVerified ?? true,
    },
    create: {
      id: doctor.id,
      userId: user.id,
      name: doctor.name,
      firstName: doctor.firstName ?? null,
      middleName: doctor.middleName ?? null,
      lastName: doctor.lastName ?? null,
      suffix: doctor.suffix ?? null,
      npi: doctor.npi,
      email: doctor.email.toLowerCase(),
      password: doctor.password,
      specialty: doctor.specialty,
      bio: doctor.bio ?? null,
      image: doctor.image ?? null,
      languages: doctor.languages || ["English"],
      rating: doctor.rating || 0,
      reviewCount: doctor.reviewCount || 0,
      availability: doctor.availability || "",
      status: doctor.status || "ONLINE",
      consultFee: doctor.consultFee ?? null,
      consultationDuration: doctor.consultationDuration || 30,
      consultationDurationUnit: doctor.consultationDurationUnit || "minutes",
      licenseNumber: doctor.licenseNumber ?? null,
      licenseState: doctor.licenseState ?? null,
      yearsExp: doctor.yearsExp ?? null,
      securityKey: doctor.securityKey ?? null,
      isActive: doctor.isActive ?? true,
      isFeatured: doctor.isFeatured ?? false,
      isVerified: doctor.isVerified ?? true,
    },
  });
}

async function main() {
  const dbPath = path.join(process.cwd(), "src/lib/mock-db.json");

  if (!fs.existsSync(dbPath)) {
    console.error("mock-db.json not found at", dbPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dbPath, "utf8");
  const data = JSON.parse(raw);

  console.log("Seeding admin...");
  await seedAdminAccount();

  console.log("Seeding patients...");
  for (const p of data.patients || []) {
    try {
      await seedPatientAccount(p);
    } catch (err) {
      console.warn("Failed to upsert patient", p.email, err.message || err);
    }
  }

  console.log("Seeding doctors...");
  for (const d of data.doctors || []) {
    try {
      await seedDoctorAccount(d);
    } catch (err) {
      console.warn("Failed to upsert doctor", d.email, err.message || err);
    }
  }

  console.log("Seeding consultations...");
  for (const c of data.consultations || []) {
    try {
      const exists = await prisma.consultation.findUnique({ where: { id: c.id } });
      if (exists) continue;

      await prisma.consultation.create({
        data: {
          id: c.id,
          patientId: c.patientId,
          doctorId: c.doctorId,
          scheduledAt: new Date(c.scheduledAt),
          status: c.status,
          reason: c.reason,
          notes: c.notes,
          prescription: c.prescription,
          duration: c.duration || 30,
          bloodPressure: c.bloodPressure || null,
          heartRate: c.heartRate || null,
          bodyTemperature: c.bodyTemperature || null,
        },
      });
    } catch (err) {
      console.warn("Failed to create consultation", c.id, err.message || err);
    }
  }

  console.log("Seeding complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect().finally(() => process.exit(1));
  });
