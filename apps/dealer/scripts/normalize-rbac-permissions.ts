/**
 * Normalize dealer RBAC permissions to the canonical catalog.
 *
 * This script:
 * - upserts the canonical dealer permission rows
 * - rewrites legacy aliases that have a direct canonical replacement
 * - re-syncs seeded system roles and DealerCenter template roles
 * - removes obsolete role-permission rows, user overrides, and permission rows
 *
 * Run with dealer DATABASE_URL:
 *   npx tsx scripts/normalize-rbac-permissions.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  ALL_REMOVED_DEALER_PERMISSION_KEYS,
  DEALER_PERMISSION_CATALOG,
  DEALERCENTER_ROLE_TEMPLATES,
  DEFAULT_SYSTEM_ROLE_KEYS,
  LEGACY_PERMISSION_RENAMES,
} from "../lib/constants/permissions";

const prisma = new PrismaClient();

type KeyToIdMap = Map<string, string>;

async function upsertCanonicalPermissions() {
  for (const permission of DEALER_PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: {
        id: crypto.randomUUID(),
        key: permission.key,
        description: permission.description,
        module: permission.module,
      },
      update: {
        description: permission.description,
        module: permission.module,
      },
    });
  }
}

async function loadKeyToId(keys?: string[]): Promise<KeyToIdMap> {
  const rows = await prisma.permission.findMany({
    where: keys ? { key: { in: keys } } : undefined,
    select: { id: true, key: true },
  });
  return new Map(rows.map((row) => [row.key, row.id]));
}

async function syncRolePermissions(roleId: string, permissionKeys: string[], keyToId: KeyToIdMap) {
  const permissionIds = permissionKeys
    .map((key) => keyToId.get(key))
    .filter((value): value is string => Boolean(value));

  await prisma.rolePermission.deleteMany({ where: { roleId } });
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }
}

async function syncSystemRoles(keyToId: KeyToIdMap) {
  for (const [roleName, permissionKeys] of Object.entries(DEFAULT_SYSTEM_ROLE_KEYS)) {
    const roles = await prisma.role.findMany({
      where: { name: roleName, isSystem: true, deletedAt: null },
      select: { id: true, dealershipId: true, name: true },
    });

    for (const role of roles) {
      await syncRolePermissions(role.id, permissionKeys, keyToId);
      console.log(`Synced system role ${role.name} @ ${role.dealershipId}`);
    }
  }
}

async function syncTemplateRoles(keyToId: KeyToIdMap) {
  for (const template of DEALERCENTER_ROLE_TEMPLATES) {
    const roles = await prisma.role.findMany({
      where: { key: template.key, deletedAt: null },
      select: { id: true, dealershipId: true },
    });

    for (const role of roles) {
      await syncRolePermissions(role.id, template.permissionKeys, keyToId);
      console.log(`Synced template role ${template.key} @ ${role.dealershipId}`);
    }
  }
}

async function migrateRolePermissions(oldPermissionId: string, newPermissionId: string) {
  const rows = await prisma.rolePermission.findMany({
    where: { permissionId: oldPermissionId },
    select: { roleId: true },
  });

  for (const row of rows) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: row.roleId,
          permissionId: newPermissionId,
        },
      },
      create: {
        roleId: row.roleId,
        permissionId: newPermissionId,
      },
      update: {},
    });
  }

  if (rows.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { permissionId: oldPermissionId } });
  }

  return rows.length;
}

async function migrateUserOverrides(oldPermissionId: string, newPermissionId: string) {
  const rows = await prisma.userPermissionOverride.findMany({
    where: { permissionId: oldPermissionId },
    select: {
      userId: true,
      enabled: true,
      createdByUserId: true,
    },
  });

  for (const row of rows) {
    const existingNew = await prisma.userPermissionOverride.findUnique({
      where: {
        userId_permissionId: {
          userId: row.userId,
          permissionId: newPermissionId,
        },
      },
      select: { userId: true },
    });

    if (!existingNew) {
      await prisma.userPermissionOverride.create({
        data: {
          userId: row.userId,
          permissionId: newPermissionId,
          enabled: row.enabled,
          createdByUserId: row.createdByUserId,
        },
      });
    }
  }

  if (rows.length > 0) {
    await prisma.userPermissionOverride.deleteMany({ where: { permissionId: oldPermissionId } });
  }

  return rows.length;
}

async function migrateLegacyAliases(keyToId: KeyToIdMap) {
  for (const [oldKey, newKey] of Object.entries(LEGACY_PERMISSION_RENAMES)) {
    const oldPermissionId = keyToId.get(oldKey);
    const newPermissionId = keyToId.get(newKey);
    if (!oldPermissionId || !newPermissionId) continue;

    const migratedRoleCount = await migrateRolePermissions(oldPermissionId, newPermissionId);
    const migratedOverrideCount = await migrateUserOverrides(oldPermissionId, newPermissionId);

    console.log(
      `Migrated ${oldKey} -> ${newKey} (${migratedRoleCount} role assignments, ${migratedOverrideCount} overrides)`
    );
  }
}

async function removeObsoletePermissions(keyToId: KeyToIdMap) {
  const obsoletePermissionIds = ALL_REMOVED_DEALER_PERMISSION_KEYS
    .map((key) => keyToId.get(key))
    .filter((value): value is string => Boolean(value));

  if (obsoletePermissionIds.length === 0) {
    return;
  }

  await prisma.rolePermission.deleteMany({
    where: { permissionId: { in: obsoletePermissionIds } },
  });
  await prisma.userPermissionOverride.deleteMany({
    where: { permissionId: { in: obsoletePermissionIds } },
  });
  await prisma.permission.deleteMany({
    where: { id: { in: obsoletePermissionIds } },
  });

  console.log(`Removed ${obsoletePermissionIds.length} obsolete permission row(s)`);
}

async function main() {
  console.log("Upserting canonical dealer permissions...");
  await upsertCanonicalPermissions();

  const relevantKeys = [
    ...DEALER_PERMISSION_CATALOG.map((permission) => permission.key),
    ...ALL_REMOVED_DEALER_PERMISSION_KEYS,
  ];
  let keyToId = await loadKeyToId(relevantKeys);

  console.log("Migrating legacy aliases...");
  await migrateLegacyAliases(keyToId);

  keyToId = await loadKeyToId(DEALER_PERMISSION_CATALOG.map((permission) => permission.key));

  console.log("Syncing default system roles...");
  await syncSystemRoles(keyToId);

  console.log("Syncing DealerCenter template roles...");
  await syncTemplateRoles(keyToId);

  keyToId = await loadKeyToId(relevantKeys);

  console.log("Removing obsolete dealer permissions...");
  await removeObsoletePermissions(keyToId);

  console.log("Dealer RBAC normalization complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
