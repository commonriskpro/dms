/**
 * Test DB connection. Usage:
 *   node scripts/test-db-connection.mjs
 *   DATABASE_URL="..." node scripts/test-db-connection.mjs
 * Load .env.local yourself or pass DATABASE_URL. Exits 0 if OK, 1 on error (message to stderr).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  await prisma.$queryRaw`SELECT 1 as ok`;
  console.log("OK");
  process.exit(0);
} catch (e) {
  console.error("DB connection failed:", e.message || e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
