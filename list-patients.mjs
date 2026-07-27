import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = await prisma.patient.findMany({ select: { email: true, firstName: true, lastName: true } });
console.log("Total patients in DB:", rows.length);
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
