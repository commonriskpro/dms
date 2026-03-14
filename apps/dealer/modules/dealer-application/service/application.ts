import * as applicationDb from "../db/application";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import type { DealerApplicationSource, DealerApplicationStatus } from "@prisma/client";
import { syncPlatformDealerApplication } from "@/lib/call-platform-internal";
import type { DealerApplicationSyncPayload } from "@dms/contracts";

const SUBMITTABLE_STATUSES: DealerApplicationStatus[] = ["draft", "invited"];
type ApplicationRecord = Awaited<ReturnType<typeof applicationDb.getDealerApplicationById>>;
type SyncMeta = { ip?: string; userAgent?: string; skipPlatformSync?: boolean };

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function buildSyncPayload(app: NonNullable<ApplicationRecord>): DealerApplicationSyncPayload {
  return {
    dealerApplicationId: app.id,
    source: app.source,
    status: app.status,
    ownerEmail: app.ownerEmail,
    dealerInviteId: app.inviteId ?? null,
    invitedByUserId: app.invitedByUserId ?? null,
    dealerDealershipId: app.dealershipId ?? null,
    platformApplicationId: app.platformApplicationId ?? null,
    platformDealershipId: app.platformDealershipId ?? null,
    submittedAt: toIso(app.submittedAt),
    approvedAt: toIso(app.approvedAt),
    rejectedAt: toIso(app.rejectedAt),
    activationSentAt: toIso(app.activationSentAt),
    activatedAt: toIso(app.activatedAt),
    reviewerUserId: app.reviewerUserId ?? null,
    reviewNotes: app.reviewNotes ?? null,
    rejectionReason: app.rejectionReason ?? null,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    profile: app.profile
      ? {
          businessInfo: (app.profile.businessInfo as Record<string, unknown> | null) ?? null,
          ownerInfo: (app.profile.ownerInfo as Record<string, unknown> | null) ?? null,
          primaryContact: (app.profile.primaryContact as Record<string, unknown> | null) ?? null,
          additionalLocations: app.profile.additionalLocations ?? null,
          pricingPackageInterest:
            (app.profile.pricingPackageInterest as Record<string, unknown> | null) ?? null,
          acknowledgments: (app.profile.acknowledgments as Record<string, unknown> | null) ?? null,
        }
      : null,
  };
}

async function syncCanonicalPlatformApplication(
  app: NonNullable<ApplicationRecord>,
  meta?: SyncMeta
) {
  if (meta?.skipPlatformSync) return;
  const result = await syncPlatformDealerApplication(buildSyncPayload(app));
  if (!result.ok) {
    throw new ApiError(
      "DOMAIN_ERROR",
      `Platform dealer application sync failed: ${result.error.message}`
    );
  }
}

export type CreateDraftInput = {
  source: DealerApplicationSource;
  ownerEmail: string;
  inviteId?: string | null;
  invitedByUserId?: string | null;
};

export async function createDraft(
  input: CreateDraftInput,
  meta?: SyncMeta
) {
  if (input.inviteId) {
    const existing = await applicationDb.getDealerApplicationByInviteId(input.inviteId);
    if (existing) {
      await syncCanonicalPlatformApplication(existing, meta);
      return existing;
    }
  }
  const normalizedEmail = input.ownerEmail.toLowerCase().trim();
  const app = await applicationDb.createDealerApplication({
    source: input.source,
    status: input.source === "invite" ? "invited" : "draft",
    ownerEmail: normalizedEmail,
    inviteId: input.inviteId ?? null,
    invitedByUserId: input.invitedByUserId ?? null,
  });
  await auditLog({
    dealershipId: null,
    actorUserId: null,
    action: "dealer_application.created",
    entity: "DealerApplication",
    entityId: app.id,
    metadata: { applicationId: app.id, source: app.source, status: app.status },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await syncCanonicalPlatformApplication(app, meta);
  return app;
}

export async function getApplication(id: string) {
  const app = await applicationDb.getDealerApplicationById(id);
  if (!app) throw new ApiError("NOT_FOUND", "Application not found");
  return app;
}

export async function getApplicationByInviteId(inviteId: string) {
  return applicationDb.getDealerApplicationByInviteId(inviteId);
}

export type UpdateDraftProfileInput = Partial<{
  businessInfo: object;
  ownerInfo: object;
  primaryContact: object;
  additionalLocations: unknown;
  pricingPackageInterest: object;
  acknowledgments: object;
}>;

export async function updateDraft(
  id: string,
  profileData: UpdateDraftProfileInput,
  meta?: SyncMeta
) {
  const app = await applicationDb.getDealerApplicationById(id);
  if (!app) throw new ApiError("NOT_FOUND", "Application not found");
  if (!SUBMITTABLE_STATUSES.includes(app.status)) {
    throw new ApiError("INVALID_STATE", "Application can no longer be edited");
  }
  await applicationDb.upsertDealerApplicationProfile(id, profileData);
  const updated = await applicationDb.getDealerApplicationById(id);
  if (!updated) throw new ApiError("NOT_FOUND", "Application not found");
  await auditLog({
    dealershipId: null,
    actorUserId: null,
    action: "dealer_application.draft_updated",
    entity: "DealerApplication",
    entityId: id,
    metadata: { applicationId: id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await syncCanonicalPlatformApplication(updated, meta);
  return updated;
}

export async function submitApplication(
  id: string,
  meta?: SyncMeta
) {
  const app = await applicationDb.getDealerApplicationById(id);
  if (!app) throw new ApiError("NOT_FOUND", "Application not found");
  if (!SUBMITTABLE_STATUSES.includes(app.status)) {
    throw new ApiError("INVALID_STATE", "Application already submitted or not in draft state");
  }
  const now = new Date();
  const updated = await applicationDb.updateDealerApplication(id, {
    status: "submitted",
    submittedAt: now,
  });
  await auditLog({
    dealershipId: null,
    actorUserId: null,
    action: "dealer_application.submitted",
    entity: "DealerApplication",
    entityId: id,
    metadata: { applicationId: id, submittedAt: now.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await syncCanonicalPlatformApplication(updated, meta);
  return updated;
}

export type ListApplicationsInput = {
  status?: DealerApplicationStatus | DealerApplicationStatus[];
  source?: DealerApplicationSource;
  limit: number;
  offset: number;
};

export async function listApplications(input: ListApplicationsInput) {
  return applicationDb.listDealerApplications(
    {
      status: input.status,
      source: input.source,
    },
    { limit: input.limit, offset: input.offset }
  );
}

export async function markActivated(
  id: string,
  meta?: SyncMeta
) {
  const app = await applicationDb.getDealerApplicationById(id);
  if (!app) throw new ApiError("NOT_FOUND", "Application not found");
  if (app.status !== "activation_sent" && app.status !== "activated") {
    throw new ApiError("INVALID_STATE", "Application must have activation sent before marking activated");
  }
  if (app.status === "activated") {
    const current = await applicationDb.getDealerApplicationById(id);
    if (!current) throw new ApiError("NOT_FOUND", "Application not found");
    await syncCanonicalPlatformApplication(current, meta);
    return current;
  }
  const now = new Date();
  const updated = await applicationDb.updateDealerApplication(id, {
    status: "activated",
    activatedAt: now,
  });
  await auditLog({
    dealershipId: null,
    actorUserId: null,
    action: "dealer_application.activated",
    entity: "DealerApplication",
    entityId: id,
    metadata: { applicationId: id, activatedAt: now.toISOString() },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await syncCanonicalPlatformApplication(updated, meta);
  return updated;
}

export type InternalUpdateApplicationInput = Partial<{
  status: DealerApplicationStatus;
  dealershipId: string | null;
  platformApplicationId: string | null;
  platformDealershipId: string | null;
  reviewerUserId: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
}>;

export async function internalUpdateApplication(
  id: string,
  data: InternalUpdateApplicationInput,
  meta?: SyncMeta
) {
  const app = await applicationDb.getDealerApplicationById(id);
  if (!app) throw new ApiError("NOT_FOUND", "Application not found");
  const updateData: applicationDb.UpdateDealerApplicationData = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.dealershipId !== undefined) updateData.dealershipId = data.dealershipId;
  if (data.platformApplicationId !== undefined)
    updateData.platformApplicationId = data.platformApplicationId;
  if (data.platformDealershipId !== undefined)
    updateData.platformDealershipId = data.platformDealershipId;
  if (data.reviewerUserId !== undefined) updateData.reviewerUserId = data.reviewerUserId;
  if (data.reviewNotes !== undefined) updateData.reviewNotes = data.reviewNotes;
  if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason;
  if (data.status === "approved") updateData.approvedAt = new Date();
  if (data.status === "rejected") updateData.rejectedAt = new Date();
  if (data.status === "activation_sent") updateData.activationSentAt = new Date();
  if (data.status === "activated") updateData.activatedAt = new Date();
  const updated = await applicationDb.updateDealerApplication(id, updateData);
  await auditLog({
    dealershipId: null,
    actorUserId: data.reviewerUserId ?? null,
    action: "dealer_application.internal_updated",
    entity: "DealerApplication",
    entityId: id,
    metadata: { applicationId: id, updatedFields: Object.keys(updateData) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await syncCanonicalPlatformApplication(updated, meta);
  return updated;
}
