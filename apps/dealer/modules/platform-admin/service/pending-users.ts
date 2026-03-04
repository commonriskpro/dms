import * as pendingDb from "../db/pending-approval";
import * as membershipDb from "@/modules/core-platform/db/membership";
import * as roleDb from "@/modules/core-platform/db/role";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";

export type ListPendingUsersInput = {
  limit: number;
  offset: number;
  search?: string;
};

export async function listPendingUsers(
  input: ListPendingUsersInput
): Promise<{ data: { id: string; userId: string; email: string; createdAt: Date }[]; total: number }> {
  const { data, total } = await pendingDb.listPendingApprovals(
    { search: input.search },
    { limit: input.limit, offset: input.offset }
  );
  return {
    data: data.map((d) => ({
      id: d.id,
      userId: d.userId,
      email: d.email,
      createdAt: d.createdAt,
    })),
    total,
  };
}

export type ApprovePendingUserInput = {
  userId: string;
  dealershipId: string;
  roleId: string;
  actorUserId: string;
};

export async function approvePendingUser(
  input: ApprovePendingUserInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ membershipId: string; dealershipId: string }> {
  const role = await roleDb.getRoleById(input.dealershipId, input.roleId);
  if (!role) throw new ApiError("NOT_FOUND", "Role not found in this dealership");

  const pending = await pendingDb.getPendingByUserId(input.userId);
  if (!pending) throw new ApiError("NOT_FOUND", "Pending user not found");

  const existing = await membershipDb.getActiveMembership(input.userId, input.dealershipId);
  if (existing) {
    return { membershipId: existing.id, dealershipId: input.dealershipId };
  }

  const membership = await membershipDb.createMembership({
    dealershipId: input.dealershipId,
    userId: input.userId,
    roleId: input.roleId,
    joinedAt: new Date(),
  });

  await pendingDb.deletePendingApproval(input.userId);

  await auditLog({
    dealershipId: input.dealershipId,
    actorUserId: input.actorUserId,
    action: "platform.membership.approved",
    entity: "PendingApproval",
    entityId: pending.id,
    metadata: {
      userId: input.userId,
      dealershipId: input.dealershipId,
      roleId: input.roleId,
      membershipId: membership.id,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { membershipId: membership.id, dealershipId: input.dealershipId };
}

export async function rejectPendingUser(
  userId: string,
  actorUserId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const pending = await pendingDb.getPendingByUserId(userId);
  if (!pending) throw new ApiError("NOT_FOUND", "Pending user not found");

  await pendingDb.deletePendingApproval(userId);

  await auditLog({
    dealershipId: null,
    actorUserId,
    action: "platform.pending.rejected",
    entity: "PendingApproval",
    entityId: pending.id,
    metadata: { userId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}
