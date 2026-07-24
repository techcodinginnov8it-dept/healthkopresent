import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Test both casings
const emailAsTyped = "jCruz@healthko.com";
const emailLower = emailAsTyped.toLowerCase();
const password = "PatHk@2026";

console.log("Looking up with exact casing:", emailAsTyped);
const exact = await prisma.patient.findUnique({ where: { email: emailAsTyped } });
console.log("Exact match:", exact ? "FOUND" : "NOT FOUND");

console.log("\nLooking up with lowercase:", emailLower);
const lower = await prisma.patient.findUnique({ where: { email: emailLower } });
console.log("Lowercase match:", lower ? "FOUND" : "NOT FOUND");

if (lower) {
  const isMatch = await bcrypt.compare(password, lower.password);
  console.log("Password match:", isMatch);
  console.log("emailVerified:", lower.emailVerified);
  console.log("isActive:", lower.isActive);
}

await prisma.$disconnect();
