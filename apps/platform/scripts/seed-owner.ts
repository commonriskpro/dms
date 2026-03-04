/**
 * Idempotent upsert of a platform user (e.g. PLATFORM_OWNER).
 * Run from repo root: cd apps/platform && dotenv -e ../../.env.platform-admin -- npx tsx scripts/seed-owner.ts
 * Or from apps/platform: dotenv -e .env.local -- npx tsx scripts/seed-owner.ts
 *
 * Requires: DATABASE_URL (platform DB), PLATFORM_OWNER_USER_ID (Supabase auth user UUID), optional ROLE (default PLATFORM_OWNER).
 */

import { PrismaClient } from "../../node_modules/.prisma/platform-client";

const prisma = new PrismaClient();

const PLATFORM_OWNER = "PLATFORM_OWNER";
const PLATFORM_COMPLIANCE = "PLATFORM_COMPLIANCE";
const PLATFORM_SUPPORT = "PLATFORM_SUPPORT";
const ROLES = [PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT] as const;

function parseUUID(s: string): string {
  const hex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!hex.test(s)) throw new Error("PLATFORM_OWNER_USER_ID must be a valid UUID (Supabase auth user id)");
  return s;
}

async function main() {
  const userId = process.env.PLATFORM_OWNER_USER_ID;
  if (!userId) {
    console.error("Set PLATFORM_OWNER_USER_ID to the Supabase auth user UUID for the platform owner.");
    process.exit(1);
  }
  const uuid = parseUUID(userId.trim());
  const role = (process.env.ROLE ?? PLATFORM_OWNER) as (typeof ROLES)[number];
  if (!ROLES.includes(role)) {
    console.error("ROLE must be one of: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT");
    process.exit(1);
  }

  await prisma.platformUser.upsert({
    where: { id: uuid },
    create: { id: uuid, role },
    update: { role },
  });
  console.log("Platform user upserted:", { id: uuid, role });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
