import * as membershipDb from "../db/membership";
import * as profileDb from "../db/profile";
import * as roleDb from "../db/role";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export async function listMemberships(
  dealershipId: string,
  options: { limit: number; offset: number; roleId?: string; status?: "active" | "disabled" }
) {
  await requireTenantActiveForRead(dealershipId);
  return membershipDb.listMemberships(dealershipId, options);
}

export async function getMembership(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const m = await membershipDb.getMembershipById(dealershipId, id);
  if (!m) throw new ApiError("NOT_FOUND", "Membership not found");
  return m;
}

export async function inviteMember(
  dealershipId: string,
  actorId: string,
  data: { email: string; roleId: string },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const role = await roleDb.getRoleById(dealershipId, data.roleId);
  if (!role) throw new ApiError("NOT_FOUND", "Role not found");
  let profile = await profileDb.getProfileByEmail(data.email);
  if (!profile) throw new ApiError("NOT_FOUND", "No user found with this email. User must sign up first.");
  const existing = await membershipDb.getActiveMembership(profile.id, dealershipId);
  if (existing) {
    const full = await membershipDb.getMembershipById(dealershipId, existing.id);
    return full!;
  }
  const created = await membershipDb.createMembership({
    dealershipId,
    userId: profile.id,
    roleId: data.roleId,
    invitedBy: actorId,
    invitedAt: new Date(),
    joinedAt: profile ? new Date() : null,
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: profile.id, roleId: data.roleId } },
    create: { userId: profile.id, roleId: data.roleId },
    update: {},
  });
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "membership.invited",
    entity: "Membership",
    entityId: created.id,
    metadata: { userId: created.userId, roleId: data.roleId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function updateMembership(
  dealershipId: string,
  id: string,
  actorId: string,
  data: { roleId?: string; disabled?: boolean },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await membershipDb.getMembershipById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Membership not found");
  let updated = existing;
  if (data.roleId !== undefined) {
    const role = await roleDb.getRoleById(dealershipId, data.roleId);
    if (!role) throw new ApiError("NOT_FOUND", "Role not found");
    await membershipDb.updateMembershipRole(dealershipId, id, data.roleId);
    updated = (await membershipDb.getMembershipById(dealershipId, id))!;
    await auditLog({
      dealershipId,
      actorUserId: actorId,
      action: "membership.role_changed",
      entity: "Membership",
      entityId: id,
      metadata: { previousRoleId: existing.roleId, roleId: data.roleId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  if (data.disabled === true) {
    await membershipDb.disableMembership(dealershipId, id, actorId);
    updated = (await membershipDb.getMembershipById(dealershipId, id))!;
    await auditLog({
      dealershipId,
      actorUserId: actorId,
      action: "membership.disabled",
      entity: "Membership",
      entityId: id,
      metadata: { userId: existing.userId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}

export async function disableMembership(
  dealershipId: string,
  id: string,
  actorId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await membershipDb.getMembershipById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Membership not found");
  await membershipDb.disableMembership(dealershipId, id, actorId);
  await auditLog({
    dealershipId,
    actorUserId: actorId,
    action: "membership.disabled",
    entity: "Membership",
    entityId: id,
    metadata: { userId: existing.userId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}
