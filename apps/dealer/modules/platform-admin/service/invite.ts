import * as inviteDb from "../db/invite";
import * as pendingDb from "../db/pending-approval";
import * as membershipDb from "@/modules/core-platform/db/membership";
import * as roleDb from "@/modules/core-platform/db/role";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { getOrCreateProfile } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForWrite } from "@/lib/tenant-status";
import { createServiceClient } from "@/lib/supabase/service";
import { validatePasswordPolicy } from "@/lib/password-policy";
import type { DealershipInviteStatus } from "@prisma/client";

/** Mask email for display: first char + '***' + '@' + domain. */
export function maskInviteEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return email[0]! + "***@" + email.slice(at + 1);
}

export type ResolveInviteResult = {
  inviteId: string;
  dealershipName: string;
  roleName: string;
  expiresAt: Date | undefined;
  emailMasked?: string;
};

/**
 * Resolve invite by token for public accept page. Returns 404 if not found,
 * 410 if expired/cancelled/already accepted. Never logs token.
 */
export async function resolveInvite(token: string): Promise<ResolveInviteResult> {
  const invite = await inviteDb.getInviteByToken(token);
  if (!invite) throw new ApiError("INVITE_NOT_FOUND", "Invite not found");
  if (invite.status === "ACCEPTED") {
    throw new ApiError("INVITE_ALREADY_ACCEPTED", "This invite has already been used");
  }
  if (invite.status === "EXPIRED" || invite.status === "CANCELLED") {
    throw new ApiError("INVITE_EXPIRED", "This invite has expired or was cancelled");
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new ApiError("INVITE_EXPIRED", "This invite has expired");
  }
  return {
    inviteId: invite.id,
    dealershipName: invite.dealership.name,
    roleName: invite.role.name,
    expiresAt: invite.expiresAt ?? undefined,
    emailMasked: maskInviteEmail(invite.email),
  };
}

export type CreateInviteInput = {
  dealershipId: string;
  email: string;
  roleId: string;
  expiresAt?: Date | null;
  actorUserId: string;
};

export type CreateInviteResult =
  | { created: true; invite: Awaited<ReturnType<typeof inviteDb.createInvite>> }
  | { created: false; invite: Awaited<ReturnType<typeof inviteDb.findPendingInviteByDealershipAndEmail>> };

export async function createInvite(
  input: CreateInviteInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<CreateInviteResult> {
  await requireTenantActiveForWrite(input.dealershipId);
  const role = await roleDb.getRoleById(input.dealershipId, input.roleId);
  if (!role) throw new ApiError("NOT_FOUND", "Role not found in this dealership");

  const existing = await inviteDb.findPendingInviteByDealershipAndEmail(
    input.dealershipId,
    input.email
  );
  if (existing) {
    return { created: false, invite: existing };
  }

  const token = inviteDb.generateInviteToken();
  const invite = await inviteDb.createInvite({
    dealershipId: input.dealershipId,
    email: input.email.toLowerCase(),
    roleId: input.roleId,
    expiresAt: input.expiresAt ?? null,
    createdBy: input.actorUserId,
    token,
  });

  await auditLog({
    dealershipId: input.dealershipId,
    actorUserId: input.actorUserId,
    action: "platform.invite.created",
    entity: "DealershipInvite",
    entityId: invite.id,
    metadata: { inviteId: invite.id, dealershipId: input.dealershipId, roleId: input.roleId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { created: true, invite };
}

export type AcceptInviteInput = {
  token: string;
  actorUserId: string;
  actorEmail: string;
};

export type AcceptInviteResult =
  | { membershipId: string; dealershipId: string; alreadyHadMembership?: false }
  | { membershipId: string; dealershipId: string; alreadyHadMembership: true };

export async function acceptInvite(
  input: AcceptInviteInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<AcceptInviteResult> {
  const invite = await inviteDb.getInviteByToken(input.token);
  if (!invite) throw new ApiError("INVITE_NOT_FOUND", "Invite not found");

  await requireTenantActiveForWrite(invite.dealershipId);

  if (invite.status === "EXPIRED" || invite.status === "CANCELLED") {
    throw new ApiError("INVITE_EXPIRED", "This invite has expired or was cancelled");
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new ApiError("INVITE_EXPIRED", "This invite has expired");
  }

  const emailMatch =
    input.actorEmail && invite.email.toLowerCase() === input.actorEmail.toLowerCase();
  if (!emailMatch) {
    throw new ApiError("INVITE_EMAIL_MISMATCH", "This invite was sent to a different email address");
  }

  const profile = await getOrCreateProfile(input.actorUserId, {
    email: input.actorEmail,
  });

  const existingMembership = await membershipDb.getActiveMembership(
    profile.id,
    invite.dealershipId
  );
  if (existingMembership) {
    return {
      membershipId: existingMembership.id,
      dealershipId: invite.dealershipId,
      alreadyHadMembership: true,
    };
  }

  if (invite.status === "ACCEPTED") {
    throw new ApiError("INVITE_ALREADY_ACCEPTED", "This invite has already been used");
  }

  const membership = await membershipDb.createMembership({
    dealershipId: invite.dealershipId,
    userId: profile.id,
    roleId: invite.roleId,
    invitedBy: invite.createdBy,
    invitedAt: new Date(),
    joinedAt: new Date(),
    inviteId: invite.id,
  });

  await inviteDb.updateInviteStatus(invite.id, "ACCEPTED", new Date(), input.actorUserId);

  await pendingDb.deletePendingApproval(profile.id);

  if (invite.dealerApplicationId) {
    await dealerApplicationService.markActivated(invite.dealerApplicationId, meta);
  }

  // Audit: only IDs — no token, no email (per spec).
  await auditLog({
    dealershipId: invite.dealershipId,
    actorUserId: input.actorUserId,
    action: "platform.invite.accepted",
    entity: "DealershipInvite",
    entityId: invite.id,
    metadata: {
      inviteId: invite.id,
      membershipId: membership.id,
      dealershipId: invite.dealershipId,
      roleId: invite.roleId,
      acceptedByUserId: input.actorUserId,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { membershipId: membership.id, dealershipId: invite.dealershipId };
}

export type AcceptInviteWithSignupInput = {
  token: string;
  email: string;
  password: string;
  fullName?: string | null;
};

/**
 * Signup path: create user via Supabase Admin, profile, membership, mark invite.
 * DealershipId only from invite. Throws EMAIL_ALREADY_REGISTERED (409) if user exists.
 */
export async function acceptInviteWithSignup(
  input: AcceptInviteWithSignupInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ membershipId: string; dealershipId: string }> {
  const invite = await inviteDb.getInviteByToken(input.token);
  if (!invite) throw new ApiError("INVITE_NOT_FOUND", "Invite not found");

  await requireTenantActiveForWrite(invite.dealershipId);

  if (invite.status === "EXPIRED" || invite.status === "CANCELLED") {
    throw new ApiError("INVITE_EXPIRED", "This invite has expired or was cancelled");
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new ApiError("INVITE_EXPIRED", "This invite has expired");
  }
  if (invite.status === "ACCEPTED") {
    throw new ApiError("INVITE_ALREADY_ACCEPTED", "This invite has already been used");
  }

  const emailMatch = invite.email.toLowerCase() === input.email.toLowerCase();
  if (!emailMatch) {
    throw new ApiError("INVITE_EMAIL_MISMATCH", "Email does not match invitation", {
      fieldErrors: { email: "Email does not match invitation" },
    });
  }

  const passwordResult = validatePasswordPolicy(input.password);
  if (!passwordResult.valid) {
    throw new ApiError("VALIDATION_ERROR", passwordResult.message ?? "Invalid password", {
      fieldErrors: { password: passwordResult.message },
    });
  }

  const supabase = createServiceClient();
  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? "";
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      createError.message === "A user with this email already has an account."
    ) {
      throw new ApiError("EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    }
    throw new ApiError("DOMAIN_ERROR", createError.message);
  }

  const newUserId = authData.user?.id;
  if (!newUserId) throw new ApiError("INTERNAL", "User creation did not return user id");

  const profile = await getOrCreateProfile(newUserId, {
    email: input.email,
    fullName: input.fullName ?? undefined,
  });

  const membership = await membershipDb.createMembership({
    dealershipId: invite.dealershipId,
    userId: profile.id,
    roleId: invite.roleId,
    invitedBy: invite.createdBy,
    invitedAt: new Date(),
    joinedAt: new Date(),
    inviteId: invite.id,
  });

  await inviteDb.updateInviteStatus(invite.id, "ACCEPTED", new Date(), newUserId);
  await pendingDb.deletePendingApproval(profile.id);

  if (invite.dealerApplicationId) {
    await dealerApplicationService.markActivated(invite.dealerApplicationId, meta);
  }

  await auditLog({
    dealershipId: invite.dealershipId,
    actorUserId: newUserId,
    action: "platform.invite.accepted",
    entity: "DealershipInvite",
    entityId: invite.id,
    metadata: {
      inviteId: invite.id,
      membershipId: membership.id,
      dealershipId: invite.dealershipId,
      roleId: invite.roleId,
      acceptedByUserId: newUserId,
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { membershipId: membership.id, dealershipId: invite.dealershipId };
}

export async function cancelInvite(
  dealershipId: string,
  inviteId: string,
  actorUserId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  await requireTenantActiveForWrite(dealershipId);
  const invite = await inviteDb.getInviteById(inviteId);
  if (!invite) throw new ApiError("NOT_FOUND", "Invite not found");
  if (invite.dealershipId !== dealershipId) {
    throw new ApiError("NOT_FOUND", "Invite not found for this dealership");
  }
  if (invite.status !== "PENDING") {
    throw new ApiError("CONFLICT", "Invite is not pending");
  }

  await inviteDb.updateInviteStatus(inviteId, "CANCELLED");

  await auditLog({
    dealershipId,
    actorUserId,
    action: "platform.invite.cancelled",
    entity: "DealershipInvite",
    entityId: inviteId,
    metadata: { inviteId, dealershipId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

/**
 * Cancel invite when initiated from platform (internal API). Uses actorUserId: null and stores platformActorId in metadata.
 */
export async function cancelInviteFromPlatform(
  dealershipId: string,
  inviteId: string,
  platformActorId: string
): Promise<void> {
  await requireTenantActiveForWrite(dealershipId);
  const invite = await inviteDb.getInviteById(inviteId);
  if (!invite) throw new ApiError("NOT_FOUND", "Invite not found");
  if (invite.dealershipId !== dealershipId) {
    throw new ApiError("NOT_FOUND", "Invite not found for this dealership");
  }
  if (invite.status !== "PENDING") {
    throw new ApiError("CONFLICT", "Invite is not pending");
  }

  await inviteDb.updateInviteStatus(inviteId, "CANCELLED");

  await auditLog({
    dealershipId,
    actorUserId: null,
    action: "platform.invite.cancelled",
    entity: "DealershipInvite",
    entityId: inviteId,
    metadata: { inviteId, dealershipId, platformActorId },
  });
}

export async function resendInvite(
  dealershipId: string,
  inviteId: string,
  actorUserId: string,
  options?: { expiresAt?: Date | null },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const invite = await inviteDb.getInviteById(inviteId);
  if (!invite) throw new ApiError("NOT_FOUND", "Invite not found");
  if (invite.dealershipId !== dealershipId) {
    throw new ApiError("NOT_FOUND", "Invite not found for this dealership");
  }
  if (invite.status !== "PENDING") {
    throw new ApiError("CONFLICT", "Invite is not pending");
  }

  const newToken = inviteDb.generateInviteToken();
  const updated = await inviteDb.updateInviteTokenAndExpiry(
    inviteId,
    newToken,
    options?.expiresAt
  );

  await auditLog({
    dealershipId,
    actorUserId,
    action: "platform.invite.created",
    entity: "DealershipInvite",
    entityId: inviteId,
    metadata: { inviteId, dealershipId, roleId: invite.roleId, changedFields: ["token"] },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}
