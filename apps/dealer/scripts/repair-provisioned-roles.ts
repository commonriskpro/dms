/**
 * One-off repair: ensure Permission rows exist and attach default permissions to Roles
 * that have none (e.g. provisioned before permissions were seeded).
 * Run with dealer DATABASE_URL: npx tsx scripts/repair-provisioned-roles.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_ROLE_KEYS: Record<string, string[]> = {
  Owner: [
    "admin.dealership.read", "admin.dealership.write", "admin.memberships.read", "admin.memberships.write",
    "admin.roles.read", "admin.roles.write", "admin.audit.read", "inventory.read", "inventory.write",
    "customers.read", "customers.write", "deals.read", "deals.write", "documents.read", "documents.write",
    "finance.read", "finance.write", "lenders.read", "lenders.write", "finance.submissions.read", "finance.submissions.write",
    "reports.read", "reports.export", "crm.read", "crm.write",
  ],
  Admin: [
    "admin.dealership.read", "admin.dealership.write", "admin.memberships.read", "admin.memberships.write",
    "admin.roles.read", "admin.audit.read", "inventory.read", "inventory.write", "customers.read", "customers.write",
    "deals.read", "deals.write", "documents.read", "documents.write", "finance.read", "lenders.read",
    "finance.submissions.read", "reports.read", "crm.read", "crm.write",
  ],
  Sales: [
    "inventory.read", "inventory.write", "customers.read", "customers.write", "deals.read", "deals.write",
    "documents.read", "documents.write", "finance.read", "lenders.read", "finance.submissions.read",
    "reports.read", "crm.read", "crm.write",
  ],
  Finance: [
    "inventory.read", "customers.read", "deals.read", "deals.write", "documents.read", "documents.write",
    "finance.read", "finance.write", "lenders.read", "lenders.write", "finance.submissions.read", "finance.submissions.write",
    "reports.read", "reports.export", "crm.read", "crm.write",
  ],
};

const ALL_KEYS = [...new Set(Object.values(DEFAULT_ROLE_KEYS).flat())];
const ROLE_NAMES = Object.keys(DEFAULT_ROLE_KEYS);

async function main() {
  console.log("Ensuring Permission rows exist...");
  for (const key of ALL_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      create: { id: crypto.randomUUID(), key, description: null, module: null },
      update: {},
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { key: { in: ALL_KEYS } },
    select: { id: true, key: true },
  });
  const keyToId = new Map(permissions.map((p) => [p.key, p.id]));

  const rolesToRepair = await prisma.role.findMany({
    where: {
      name: { in: ROLE_NAMES },
      deletedAt: null,
    },
    include: {
      _count: { select: { rolePermissions: true } },
      dealership: { select: { name: true } },
    },
  });

  const emptyRoles = rolesToRepair.filter((r) => r._count.rolePermissions === 0);
  if (emptyRoles.length === 0) {
    console.log("No roles with missing permissions.");
    return;
  }

  console.log(`Repairing ${emptyRoles.length} role(s) with no permissions...`);
  for (const role of emptyRoles) {
    const keys = DEFAULT_ROLE_KEYS[role.name] ?? [];
    const permIds = keys.filter((k) => keyToId.has(k)).map((k) => keyToId.get(k)!);
    if (permIds.length === 0) {
      console.warn(`  Role ${role.id} (${role.name} @ ${role.dealership.name}) has no matching permissions, skipping.`);
      continue;
    }
    await prisma.rolePermission.createMany({
      data: permIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
    console.log(`  Attached ${permIds.length} permissions to ${role.name} @ ${role.dealership.name}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
