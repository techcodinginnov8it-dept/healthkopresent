require("@next/env").loadEnvConfig(process.cwd());
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const doctors = await prisma.doctor.findMany({ select: { id: true, email: true, name: true, specialty: true } });
  const patients = await prisma.patient.findMany({ select: { id: true, email: true, firstName: true, lastName: true } });

  console.log("=== SUPABASE POSTGRES DOCTORS ===");
  console.table(doctors);

  console.log("\n=== SUPABASE POSTGRES PATIENTS ===");
  console.table(patients);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
