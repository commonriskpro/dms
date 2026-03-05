import { prisma } from "@/lib/db";

/**
 * List role IDs assigned to a user (roles must belong to the given dealership).
 */
export async function listUserRoleIds(userId: string, dealershipId: string): Promise<string[]> {
  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      role: { dealershipId, deletedAt: null },
    },
    select: { roleId: true },
  });
  return rows.map((r) => r.roleId);
}

/**
 * Replace user's roles with the given set. All roleIds must belong to dealershipId.
 * Caller must ensure user has membership in dealership.
 */
export async function setUserRoles(
  userId: string,
  dealershipId: string,
  roleIds: string[]
): Promise<{ roleIds: string[] }> {
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, dealershipId, deletedAt: null },
    select: { id: true },
  });
  const validIds = roles.map((r) => r.id);
  await prisma.userRole.deleteMany({ where: { userId } });
  if (validIds.length) {
    await prisma.userRole.createMany({
      data: validIds.map((roleId) => ({ userId, roleId })),
    });
  }
  return { roleIds: validIds };
}

/**
 * List permission overrides for a user (key -> enabled).
 */
export async function listUserPermissionOverrides(
  userId: string
): Promise<{ permissionKey: string; enabled: boolean }[]> {
  const rows = await prisma.userPermissionOverride.findMany({
    where: { userId },
    include: { permission: true },
  });
  return rows.map((o) => ({ permissionKey: o.permission.key, enabled: o.enabled }));
}

/**
 * Set or remove a permission override. Creates or updates UserPermissionOverride.
 */
export async function setPermissionOverride(
  userId: string,
  permissionKey: string,
  enabled: boolean,
  createdByUserId: string
): Promise<{ permissionKey: string; enabled: boolean }> {
  const perm = await prisma.permission.findUnique({ where: { key: permissionKey } });
  if (!perm) throw new Error("Permission not found");
  await prisma.userPermissionOverride.upsert({
    where: { userId_permissionId: { userId, permissionId: perm.id } },
    create: {
      userId,
      permissionId: perm.id,
      enabled,
      createdByUserId,
    },
    update: { enabled, createdByUserId },
  });
  return { permissionKey, enabled };
}
