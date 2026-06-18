import { createRequire } from "node:module";
import type { PrismaClient as PrismaClientType } from "@prisma/client";

const require = createRequire(import.meta.url);

let PrismaClientCtor: any = null;

try {
  ({ PrismaClient: PrismaClientCtor } = require("@prisma/client") as typeof import("@prisma/client"));
} catch (error) {
  console.warn("[prisma] Prisma client is unavailable, falling back to mock data mode:", error);
}

export function isPrismaConfigured() {
  return Boolean(process.env.DATABASE_URL) && Boolean(PrismaClientCtor);
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  (PrismaClientCtor
    ? new PrismaClientCtor({
        log: ["query"],
      })
    : (new Proxy(
        {},
        {
          get() {
            throw new Error('@prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.');
          },
        },
      ) as PrismaClientType));

if (process.env.NODE_ENV !== "production" && PrismaClientCtor) globalForPrisma.prisma = prisma;
