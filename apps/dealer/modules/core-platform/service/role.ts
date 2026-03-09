import * as roleDb from "../db/role";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export async function listRoles(
  dealershipId: string,
  options: { limit: number; offset: number; includeSystem?: boolean }
) {
  await requireTenantActiveForRead(dealershipId);
  return roleDb.listRoles(dealershipId, options);
}

export async function getRole(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const role = await roleDb.getRoleById(dealershipId, id);
  if (!role) throw new ApiError("NOT_FOUND", "Role not found");
  return role;
}

export async function createRole(
  dealershipId: string,
  actorId: string,
  data: { name: string; permissionIds: string[] },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const created = await roleDb.createRole(dealershipId, {
    name: data.name,
    isSystem: false,
    permissionIds: data.permissionIds,
  });
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "role.created",
    entity: "Role",
    entityId: created.id,
    metadata: { name: created.name, permissionIds: data.permissionIds },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateRole(
  dealershipId: string,
  id: string,
  actorId: string,
  data: { name?: string; permissionIds?: string[] },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await roleDb.getRoleById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Role not found");
  if (existing.isSystem && data.permissionIds !== undefined) {
    throw new ApiError("FORBIDDEN", "Cannot change permissions of system role");
  }
  const updated = await roleDb.updateRole(dealershipId, id, data);
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "role.updated",
    entity: "Role",
    entityId: id,
    metadata: { name: updated.name, permissionIds: data.permissionIds ?? updated.rolePermissions.map((rp) => rp.permission.id) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

export async function deleteRole(
  dealershipId: string,
  id: string,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await roleDb.getRoleById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Role not found");
  if (existing.isSystem) throw new ApiError("FORBIDDEN", "Cannot delete system role");
  const count = await roleDb.countMembersWithRole(id);
  if (count > 0) throw new ApiError("CONFLICT", "Role is in use; reassign or remove members first");
  await roleDb.softDeleteRole(dealershipId, id, actorId);
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "role.deleted",
    entity: "Role",
    entityId: id,
    metadata: { name: existing.name },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}
