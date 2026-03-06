import { PrismaClient } from "../../node_modules/.prisma/platform-client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrisma(): PrismaClient {
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
