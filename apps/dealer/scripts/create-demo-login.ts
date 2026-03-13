/**
 * Creates the demo user in Supabase and links them as Owner of the demo dealership.
 * Run from repo root: npm run demo:create-login --prefix apps/dealer (loads .env.local from repo root).
 * Requires: DEMO_USER_EMAIL, DEMO_USER_PASSWORD, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.
 * Run db:seed first so the demo dealership and Owner role exist.
 *
 * Env must be loaded before Prisma/auth modules so DATABASE_URL is set when the client is created.
 */

import path from "path";
import fs from "fs";

// Load .env.local from repo root FIRST (before any other app imports that use process.env)
function loadEnvLocal(): void {
  const cwd = process.cwd();
  const root = cwd.endsWith("apps/dealer") || cwd.includes("apps/dealer") ? path.resolve(cwd, "../..") : cwd;
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "";
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";

async function main() {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const { getOrCreateProfile } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/db");
  const { validatePasswordPolicy } = await import("@/lib/password-policy");

  if (!DEMO_USER_EMAIL || !DEMO_USER_PASSWORD) {
    console.error("Set DEMO_USER_EMAIL and DEMO_USER_PASSWORD in .env.local (repo root).");
    console.error("Example: DEMO_USER_EMAIL=demo@example.com  DEMO_USER_PASSWORD=DemoPassword123!");
    process.exit(1);
  }

  const passwordResult = validatePasswordPolicy(DEMO_USER_PASSWORD);
  if (!passwordResult.valid) {
    console.error("Password policy:", passwordResult.message);
    process.exit(1);
  }

  const dealership = await prisma.dealership.findFirst({
    where: { slug: "demo" },
    orderBy: { createdAt: "asc" },
  });
  if (!dealership) {
    console.error("No demo dealership found. Run db:seed first.");
    process.exit(1);
  }

  const ownerRole = await prisma.role.findFirst({
    where: { dealershipId: dealership.id, name: "Owner", deletedAt: null },
  });
  if (!ownerRole) {
    console.error("Owner role not found. Run db:seed first.");
    process.exit(1);
  }

  const supabase = createServiceClient();
  const email = DEMO_USER_EMAIL.trim().toLowerCase();

  const { data: authData, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_USER_PASSWORD,
    email_confirm: true,
  });

  let userId: string;
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      const profile = await prisma.profile.findUnique({ where: { email } });
      if (!profile) {
        console.error("User exists in Supabase but no Profile found. Use Supabase dashboard to get user id or delete the user and re-run.");
        process.exit(1);
      }
      userId = profile.id;
      console.log("Demo user already exists in Supabase:", email);
    } else {
      console.error("Supabase createUser failed:", error.message);
      process.exit(1);
    }
  } else {
    userId = authData.user?.id ?? "";
    if (!userId) {
      console.error("CreateUser did not return user id");
      process.exit(1);
    }
    console.log("Created demo user in Supabase:", email);
  }

  const profile = await getOrCreateProfile(userId, { email, fullName: "Demo User" });

  const membership = await prisma.membership.findFirst({
    where: { userId: profile.id, dealershipId: dealership.id, disabledAt: null },
  });
  if (membership) {
    console.log("Demo user already linked to demo dealership.");
  } else {
    await prisma.membership.create({
      data: {
        dealershipId: dealership.id,
        userId: profile.id,
        roleId: ownerRole.id,
        joinedAt: new Date(),
      },
    });
    console.log("Linked demo user as Owner of demo dealership.");
  }

  await prisma.userActiveDealership.upsert({
    where: { userId: profile.id },
    create: { userId: profile.id, activeDealershipId: dealership.id },
    update: { activeDealershipId: dealership.id },
  });
  console.log("Set active dealership for demo user.");

  console.log("\nDemo login ready. Use DEMO_USER_EMAIL and DEMO_USER_PASSWORD in .env.local for the demo pipeline.");
}

main()
  .then(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    try {
      const { prisma } = await import("@/lib/db");
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
