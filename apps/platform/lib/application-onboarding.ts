/**
 * Application → Dealership provision and owner invite.
 * Server-only. All operations require platform DB + dealer internal API.
 */

import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { callDealerProvision, callDealerOwnerInvite, callDealerOwnerInviteStatus } from "@/lib/call-dealer-internal";
import { sendOwnerInviteEmail } from "@/lib/email/resend";
import { hashEmail } from "@/lib/hash";

const DEFAULT_PLAN_KEY = "standard";

export type ProvisionFromApplicationResult = {
  dealershipId: string;
  displayName: string;
  status: string;
  dealerDealershipId?: string;
  provisionedAt?: string;
};

export async function provisionDealershipFromApplication(
  applicationId: string,
  actorUserId: string
): Promise<ProvisionFromApplicationResult> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { dealership: { include: { mapping: true } } },
  });
  if (!app) throw new ApplicationNotFoundError(applicationId);
  if (app.status !== "APPROVED") {
    throw new InvalidStateError("Application must be APPROVED to provision");
  }

  if (app.dealershipId && app.dealership) {
    const d = app.dealership;
    return {
      dealershipId: d.id,
      displayName: d.displayName,
      status: d.status,
      dealerDealershipId: d.mapping?.dealerDealershipId,
      provisionedAt: d.mapping?.provisionedAt?.toISOString(),
    };
  }

  const idempotencyKey = `app-provision-${applicationId}`;
  const created = await prisma.platformDealership.create({
    data: {
      legalName: app.legalName,
      displayName: app.displayName,
      planKey: DEFAULT_PLAN_KEY,
      limits: {},
      status: "APPROVED",
    },
  });

  await prisma.platformDealership.update({
    where: { id: created.id },
    data: { status: "PROVISIONING" },
  });

  const requestId = `provision-app-${applicationId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const result = await callDealerProvision(
    created.id,
    created.legalName,
    created.displayName,
    created.planKey,
    (created.limits as Record<string, unknown>) ?? {},
    idempotencyKey,
    { jti: requestId }
  );

  if (!result.ok) {
    await prisma.platformDealership.update({
      where: { id: created.id },
      data: { status: "APPROVED" },
    });
    await platformAuditLog({
      actorPlatformUserId: actorUserId,
      action: "application.provision",
      targetType: "application",
      targetId: applicationId,
      beforeState: null,
      afterState: { dealershipId: created.id, dealerCallFailed: true, requestId: result.jti },
      requestId: result.jti,
    });
    throw new DealerProvisionError(result.error.message, result.error.status);
  }

  const { dealerDealershipId, provisionedAt } = result.data;
  await prisma.dealershipMapping.create({
    data: {
      platformDealershipId: created.id,
      dealerDealershipId,
      provisionedAt: new Date(provisionedAt),
    },
  });
  await prisma.platformDealership.update({
    where: { id: created.id },
    data: { status: "PROVISIONED" },
  });
  await prisma.application.update({
    where: { id: applicationId },
    data: { dealershipId: created.id },
  });

  await platformAuditLog({
    actorPlatformUserId: actorUserId,
    action: "application.provision",
    targetType: "application",
    targetId: applicationId,
    beforeState: null,
    afterState: {
      dealershipId: created.id,
      dealerDealershipId,
      provisionedAt,
      requestId: result.jti,
    },
    requestId: result.jti,
  });

  return {
    dealershipId: created.id,
    displayName: created.displayName,
    status: "PROVISIONED",
    dealerDealershipId,
    provisionedAt,
  };
}

export type InviteOwnerResult = {
  inviteId: string;
  status: "PENDING";
  expiresAt?: string;
};

export async function inviteOwnerForApplication(
  applicationId: string,
  actorUserId: string
): Promise<InviteOwnerResult> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { dealership: { include: { mapping: true } } },
  });
  if (!app) throw new ApplicationNotFoundError(applicationId);
  if (app.status !== "APPROVED") {
    throw new InvalidStateError("Application must be APPROVED to invite owner");
  }

  let platformDealershipId = app.dealershipId;
  let dealerDealershipId: string | undefined = app.dealership?.mapping?.dealerDealershipId;

  if (!platformDealershipId || !dealerDealershipId) {
    const provisionResult = await provisionDealershipFromApplication(applicationId, actorUserId);
    platformDealershipId = provisionResult.dealershipId;
    dealerDealershipId = provisionResult.dealerDealershipId;
  }

  if (!dealerDealershipId) {
    throw new InvalidStateError("Dealership not provisioned");
  }

  const idempotencyKey = `app-invite-owner-${applicationId}-${hashEmail(app.contactEmail)}`;
  const result = await callDealerOwnerInvite(
    dealerDealershipId,
    app.contactEmail,
    platformDealershipId,
    actorUserId,
    idempotencyKey,
    { requestId: `invite-owner-${applicationId}-${Date.now()}` }
  );

  if (!result.ok) {
    if (result.error.status === 409) {
      throw new ConflictError(result.error.message || "Dealership may already have an owner or invite in progress");
    }
    throw new DealerInviteError(result.error.message, result.error.status);
  }

  const invite = result.data;
  const dealershipName = app.dealership?.displayName ?? app.displayName;
  const requestId = `invite-owner-${applicationId}-${Date.now()}`;
  if (invite.acceptUrl && platformDealershipId) {
    try {
      await sendOwnerInviteEmail({
        toEmail: app.contactEmail,
        dealershipName,
        acceptUrl: invite.acceptUrl,
        supportEmail: process.env.PLATFORM_SUPPORT_EMAIL ?? undefined,
      });
      const recipientHash = hashEmail(app.contactEmail);
      await prisma.platformEmailLog.create({
        data: {
          platformDealershipId,
          type: "OWNER_INVITE",
          recipientHash,
          sentAt: new Date(),
          requestId,
        },
      });
    } catch {
      // Log but do not fail; invite was created, admin can copy link
    }
  }

  await platformAuditLog({
    actorPlatformUserId: actorUserId,
    action: "application.owner_invite_sent",
    targetType: "application",
    targetId: applicationId,
    beforeState: null,
    afterState: { inviteId: invite.inviteId },
  });

  return {
    inviteId: invite.inviteId,
    status: "PENDING" as const,
    expiresAt: undefined,
  };
}

export type OwnerInviteStatus = {
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  expiresAt?: string | null;
  acceptedAt?: string | null;
  lastSentAt?: string | null;
};

export async function getOwnerInviteStatusForApplication(
  applicationId: string
): Promise<OwnerInviteStatus | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { dealership: { include: { mapping: true } } },
  });
  if (!app || !app.dealershipId || !app.dealership?.mapping?.dealerDealershipId) {
    return null;
  }

  const dealerDealershipId = app.dealership.mapping.dealerDealershipId;
  const result = await callDealerOwnerInviteStatus(dealerDealershipId, app.contactEmail);
  if (!result.ok) return null;

  return {
    status: result.data.status,
    expiresAt: result.data.expiresAt ?? null,
    acceptedAt: result.data.acceptedAt ?? null,
    lastSentAt: null,
  };
}

export class ApplicationNotFoundError extends Error {
  constructor(public applicationId: string) {
    super("Application not found");
    this.name = "ApplicationNotFoundError";
  }
}

export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

export class DealerProvisionError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "DealerProvisionError";
  }
}

export class DealerInviteError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "DealerInviteError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
