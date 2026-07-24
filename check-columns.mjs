import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const r = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='consultations' ORDER BY column_name`);
console.log("Consultation columns:", JSON.stringify(r, null, 2));
await prisma.$disconnect();
