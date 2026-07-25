import "dotenv/config";
import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "stdout", level: "error" },
      { emit: "stdout", level: "warn" },
    ],
  });

// @ts-ignore - Prisma event typing can be strict
prisma.$on("query", (e: any) => {
  if (e.duration >= 100) {
    console.warn(`[Prisma Slow Query] ${e.duration}ms - ${e.query}`);
  }
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
