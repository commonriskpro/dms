/**
 * One-off repair: ensure Permission rows exist and attach default permissions to Roles
 * that have none (e.g. provisioned before permissions were seeded).
 * Run with dealer DATABASE_URL: npx tsx scripts/repair-provisioned-roles.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  ALL_PROVISION_PERMISSION_KEYS,
  DEFAULT_SYSTEM_ROLE_KEYS,
} from "../lib/constants/permissions";

const prisma = new PrismaClient();

const DEFAULT_ROLE_KEYS = DEFAULT_SYSTEM_ROLE_KEYS;
const ALL_KEYS = ALL_PROVISION_PERMISSION_KEYS;
const ROLE_NAMES = Object.keys(DEFAULT_ROLE_KEYS) as Array<keyof typeof DEFAULT_ROLE_KEYS>;

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
    const roleName = role.name as keyof typeof DEFAULT_ROLE_KEYS;
    const keys = DEFAULT_ROLE_KEYS[roleName] ?? [];
    const permIds = keys
      .filter((permissionKey) => keyToId.has(permissionKey))
      .map((permissionKey) => keyToId.get(permissionKey) as string);
    if (permIds.length === 0) {
      console.warn(`  Role ${role.id} (${role.name} @ ${role.dealership.name}) has no matching permissions, skipping.`);
      continue;
    }
    await prisma.rolePermission.createMany({
      data: permIds.map((permissionId: string) => ({ roleId: role.id, permissionId })),
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
