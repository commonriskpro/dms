import * as userRolesDb from "../db/user-roles";
import * as membershipDb from "../db/membership";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";

/**
 * Assign roles to a user. User must belong to dealership (have active membership).
 * All roleIds must belong to dealershipId.
 */
export async function assignRoles(
  dealershipId: string,
  targetUserId: string,
  roleIds: string[],
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ roleIds: string[] }> {
  await requireTenantActiveForWrite(dealershipId);
  const membership = await membershipDb.getActiveMembership(targetUserId, dealershipId);
  if (!membership) {
    throw new ApiError("NOT_FOUND", "User is not a member of this dealership");
  }
  const previous = await userRolesDb.listUserRoleIds(targetUserId, dealershipId);
  const result = await userRolesDb.setUserRoles(targetUserId, dealershipId, roleIds);
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "user_roles.assigned",
    entity: "UserRole",
    entityId: targetUserId,
    metadata: { previousRoleIds: previous, roleIds: result.roleIds },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return result;
}

/**
 * Set a permission override for a user. User must belong to dealership.
 */
export async function setPermissionOverride(
  dealershipId: string,
  targetUserId: string,
  permissionKey: string,
  enabled: boolean,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ permissionKey: string; enabled: boolean }> {
  await requireTenantActiveForWrite(dealershipId);
  const membership = await membershipDb.getActiveMembership(targetUserId, dealershipId);
  if (!membership) {
    throw new ApiError("NOT_FOUND", "User is not a member of this dealership");
  }
  const result = await userRolesDb.setPermissionOverride(
    targetUserId,
    permissionKey,
    enabled,
    actorId
  );
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "user_permission_override.set",
    entity: "UserPermissionOverride",
    entityId: targetUserId,
    metadata: { permissionKey, enabled },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return result;
}

/**
 * Get one user (membership) by userId in dealership with roleIds and permission overrides.
 */
export async function getUserDetail(dealershipId: string, userId: string) {
  const membership = await membershipDb.getMembershipByUserId(dealershipId, userId);
  if (!membership) return null;
  const [roleIds, permissionOverrides] = await Promise.all([
    userRolesDb.listUserRoleIds(userId, dealershipId),
    userRolesDb.listUserPermissionOverrides(userId),
  ]);
  return { ...membership, roleIds, permissionOverrides };
}

/**
 * List users (memberships) for dealership with their assigned role IDs and permission overrides.
 */
export async function listUsersWithRolesAndOverrides(
  dealershipId: string,
  options: { limit: number; offset: number; roleId?: string; status?: "active" | "disabled" }
) {
  const { data, total } = await membershipDb.listMemberships(dealershipId, options);
  const userIds = data.map((m) => m.userId);
  const [userRolesList, overridesList] = await Promise.all([
    Promise.all(
      userIds.map((uid) =>
        userRolesDb.listUserRoleIds(uid, dealershipId).then((ids) => ({ userId: uid, roleIds: ids }))
      )
    ),
    Promise.all(
      userIds.map((uid) =>
        userRolesDb.listUserPermissionOverrides(uid).then((o) => ({ userId: uid, overrides: o }))
      )
    ),
  ]);
  const roleIdsByUser = Object.fromEntries(userRolesList.map((r) => [r.userId, r.roleIds]));
  const overridesByUser = Object.fromEntries(overridesList.map((o) => [o.userId, o.overrides]));
  return {
    data: data.map((m) => ({
      ...m,
      roleIds: roleIdsByUser[m.userId] ?? [],
      permissionOverrides: overridesByUser[m.userId] ?? [],
    })),
    total,
  };
}
