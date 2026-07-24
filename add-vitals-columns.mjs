import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

console.log("Adding missing vitals columns to consultations table...");

await prisma.$executeRawUnsafe(`
  ALTER TABLE consultations
    ADD COLUMN IF NOT EXISTS "bloodPressure" TEXT,
    ADD COLUMN IF NOT EXISTS "heartRate" TEXT,
    ADD COLUMN IF NOT EXISTS "bodyTemperature" TEXT
`);

console.log("✅ Done! Columns added.");

// Verify
const cols = await prisma.$queryRawUnsafe(
  `SELECT column_name FROM information_schema.columns WHERE table_name='consultations' ORDER BY column_name`
);
console.log("Current columns:", cols.map((c) => c.column_name).join(", "));

await prisma.$disconnect();
