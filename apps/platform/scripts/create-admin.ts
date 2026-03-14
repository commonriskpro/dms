/**
 * Create a platform admin you can log in with (local or Supabase).
 *
 * Usage (from repo root; or from apps/platform with dotenv):
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/dms_platform" \
 *   npx tsx apps/platform/scripts/create-admin.ts
 *
 * Or load .env.platform-admin: cd apps/platform && dotenv -e .env.platform-admin -- npx tsx scripts/create-admin.ts
 *
 * With Supabase (email/password login at /platform/login):
 *   DATABASE_URL="..." \
 *   NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   PLATFORM_ADMIN_EMAIL="admin@example.com" \
 *   PLATFORM_ADMIN_PASSWORD="your-secure-password" \
 *   npx tsx apps/platform/scripts/create-admin.ts
 *
 * Without Supabase (dev-login only):
 *   Creates a platform_users row with a new UUID. Then set PLATFORM_USE_HEADER_AUTH=true
 *   in .env.platform-admin and open: /platform/dev-login?userId=<printed-uuid>
 */

import { randomUUID } from "crypto";
import { PrismaClient } from "../../node_modules/.prisma/platform-client";

const prisma = new PrismaClient();

const PLATFORM_OWNER = "PLATFORM_OWNER";

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL ?? "platform-admin@local.dev";
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "platform-admin-local";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let userId: string;

  if (supabaseUrl && serviceRoleKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      if (error.message.includes("already been registered")) {
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          userId = existing.id;
          console.log("Supabase user already exists, linking to platform_users:", existing.id);
        } else {
          throw new Error(`Supabase error: ${error.message}`);
        }
      } else {
        throw new Error(`Supabase createUser failed: ${error.message}`);
      }
    } else {
      userId = data.user.id;
      console.log("Supabase user created:", data.user.id, data.user.email);
    }
  } else {
    userId = randomUUID();
    await prisma.platformUser.create({
      data: { id: userId, role: PLATFORM_OWNER },
    });
    console.log("Platform user created (dev-login only):", userId);
    console.log("");
    console.log("To log in without Supabase:");
    console.log("  1. In .env.platform-admin set: PLATFORM_USE_HEADER_AUTH=true");
    console.log("  2. Restart the platform app, then open:");
    console.log(`     http://localhost:3001/platform/dev-login?userId=${userId}`);
    console.log("");
    return;
  }

  await prisma.platformUser.upsert({
    where: { id: userId },
    create: { id: userId, role: PLATFORM_OWNER },
    update: { role: PLATFORM_OWNER },
  });
  console.log("Platform user upserted:", { id: userId, role: PLATFORM_OWNER });
  console.log("");
  console.log("Log in at: http://localhost:3001/platform/login");
  console.log("  Email:", email);
  console.log("  Password:", password);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
