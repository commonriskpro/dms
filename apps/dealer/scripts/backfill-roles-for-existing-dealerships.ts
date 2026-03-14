/**
 * Backfill new system roles (General Manager, Sales Manager, BDC, F&I, etc.) for existing dealerships
 * that were provisioned before those roles were added to DEFAULT_SYSTEM_ROLE_KEYS.
 *
 * Run from repo root:
 *   dotenv -e .env.local -- npm run db:backfill-roles --prefix apps/dealer
 * Or for a single dealership:
 *   dotenv -e .env.local -- npx tsx apps/dealer/scripts/backfill-roles-for-existing-dealerships.ts <dealershipId>
 *
 * Requires: DATABASE_URL (or DIRECT_DATABASE_URL) in .env.local.
 */

import path from "path";
import fs from "fs";

function loadEnvLocal(): void {
  const cwd = process.cwd();
  const root = cwd.endsWith("apps/dealer") || cwd.includes("apps/dealer") ? path.resolve(cwd, "../..") : cwd;
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();

async function main() {
  const dealershipIdArg = process.argv[2];

  const [
    { prisma },
    { DEFAULT_SYSTEM_ROLE_KEYS, ALL_PROVISION_PERMISSION_KEYS },
    roleDb,
  ] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/constants/permissions"),
    import("@/modules/core-platform/db/role"),
  ]);

  const roleNames = Object.keys(DEFAULT_SYSTEM_ROLE_KEYS);
  const permissionKeys = ALL_PROVISION_PERMISSION_KEYS;

  // Ensure all permission rows exist (same as provision)
  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      create: {
        id: crypto.randomUUID(),
        key,
        description: null,
        module: null,
      },
      update: {},
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
    select: { id: true, key: true },
  });
  const keyToId = new Map(permissions.map((p) => [p.key, p.id]));

  const dealerships = dealershipIdArg
    ? await prisma.dealership.findMany({ where: { id: dealershipIdArg } })
    : await prisma.dealership.findMany({ orderBy: { createdAt: "asc" } });

  if (dealerships.length === 0) {
    console.log(dealershipIdArg ? `No dealership found with id ${dealershipIdArg}` : "No dealerships found.");
    process.exit(0);
    return;
  }

  console.log(`Backfilling roles for ${dealerships.length} dealership(s). Role set: ${roleNames.join(", ")}`);

  let totalCreated = 0;

  for (const dealership of dealerships) {
    const existing = await prisma.role.findMany({
      where: { dealershipId: dealership.id, deletedAt: null },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((r) => r.name));
    const toCreate = roleNames.filter((n) => !existingNames.has(n));

    if (toCreate.length === 0) {
      console.log(`  ${dealership.name} (${dealership.id}): already has all roles, skip`);
      continue;
    }

    for (const roleName of toCreate) {
      const keys = DEFAULT_SYSTEM_ROLE_KEYS[roleName] ?? [];
      const permissionIds = keys.filter((k) => keyToId.has(k)).map((k) => keyToId.get(k)!);
      await roleDb.createRole(dealership.id, {
        name: roleName,
        isSystem: true,
        permissionIds,
      });
      totalCreated++;
    }
    console.log(`  ${dealership.name} (${dealership.id}): added ${toCreate.length} role(s): ${toCreate.join(", ")}`);
  }

  console.log(`Done. Created ${totalCreated} role(s) across ${dealerships.length} dealership(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
