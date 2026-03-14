import { prisma } from "@/lib/db";

export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1 as ok`;
}
