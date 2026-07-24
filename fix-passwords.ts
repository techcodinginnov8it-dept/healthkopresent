import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 1. List all doctors
  const doctors = await prisma.doctor.findMany({
    select: { id: true, email: true, npi: true, name: true, password: true },
  });
  console.log(`\nFound ${doctors.length} doctors in Postgres:\n`);

  for (const doc of doctors) {
    const matches = await bcrypt.compare("123456", doc.password);
    console.log(`  ${doc.email} | password matches '123456': ${matches}`);
  }

  // 2. Update ALL doctor passwords to "123456"
  const newHash = await bcrypt.hash("123456", 10);
  console.log("\nUpdating all doctor passwords to '123456'...");
  const result = await prisma.doctor.updateMany({
    data: { password: newHash },
  });
  console.log(`Updated ${result.count} doctors.`);

  // 3. Verify
  const updated = await prisma.doctor.findMany({
    select: { email: true, password: true },
  });
  for (const doc of updated) {
    const matches = await bcrypt.compare("123456", doc.password);
    console.log(`  ${doc.email} | now matches '123456': ${matches}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
