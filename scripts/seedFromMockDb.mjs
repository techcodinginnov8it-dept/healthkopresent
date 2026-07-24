import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dbPath = path.join(process.cwd(), "src/lib/mock-db.json");

  if (!fs.existsSync(dbPath)) {
    console.error("mock-db.json not found at", dbPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dbPath, "utf8");
  const data = JSON.parse(raw);

  console.log("Seeding patients...");
  for (const p of data.patients || []) {
    try {
      await prisma.patient.upsert({
        where: { email: p.email },
        update: {
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          suffix: p.suffix,
          countryCode: p.countryCode,
          phone: p.phone,
          dob: p.dob,
          gender: p.gender,
          password: p.password,
          hipaaConsent: p.hipaaConsent,
          isActive: p.isActive,
          emailVerified: p.emailVerified,
        },
        create: {
          id: p.id,
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          suffix: p.suffix,
          email: p.email,
          countryCode: p.countryCode,
          phone: p.phone,
          dob: p.dob,
          gender: p.gender,
          password: p.password,
          hipaaConsent: p.hipaaConsent,
          isActive: p.isActive,
          emailVerified: p.emailVerified,
        },
      });
    } catch (err) {
      console.warn("Failed to upsert patient", p.email, err.message || err);
    }
  }

  console.log("Seeding doctors...");
  for (const d of data.doctors || []) {
    try {
      await prisma.doctor.upsert({
        where: { email: d.email },
        update: {
          name: d.name,
          npi: d.npi,
          password: d.password,
          specialty: d.specialty,
          bio: d.bio,
          image: d.image,
          languages: d.languages || ["English"],
          rating: d.rating || 0,
          reviewCount: d.reviewCount || 0,
          availability: d.availability || "",
          status: d.status || "ONLINE",
          consultFee: d.consultFee || null,
          isActive: d.isActive,
          isFeatured: d.isFeatured,
          isVerified: d.isVerified,
        },
        create: {
          id: d.id,
          name: d.name,
          npi: d.npi,
          email: d.email,
          password: d.password,
          specialty: d.specialty,
          bio: d.bio,
          image: d.image,
          languages: d.languages || ["English"],
          rating: d.rating || 0,
          reviewCount: d.reviewCount || 0,
          availability: d.availability || "",
          status: d.status || "ONLINE",
          consultFee: d.consultFee || null,
          isActive: d.isActive,
          isFeatured: d.isFeatured,
          isVerified: d.isVerified,
        },
      });
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
          duration: c.duration || null,
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
