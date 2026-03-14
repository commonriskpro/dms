import { platformAuditLog } from "@/lib/audit";
import {
  getDealerApplicationByDealerId,
  listDealerApplications,
  updateDealerApplicationByDealerId,
  upsertDealerApplication,
  type DealerApplicationSyncInput,
} from "@/lib/db/dealer-applications";
import { callDealerApplicationStateSync } from "@/lib/call-dealer-internal";
import type {
  DealerApplicationPatchRequest,
  DealerApplicationSyncPayload,
  DealerApplicationsListResponse,
  DealerApplicationDetail,
} from "@dms/contracts";

type DealerApplicationRecord = Awaited<ReturnType<typeof getDealerApplicationByDealerId>>;

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toProfile(record: DealerApplicationRecord) {
  if (!record?.profile) return null;
  return {
    businessInfo: (record.profile.businessInfo as Record<string, unknown> | null) ?? null,
    ownerInfo: (record.profile.ownerInfo as Record<string, unknown> | null) ?? null,
    primaryContact: (record.profile.primaryContact as Record<string, unknown> | null) ?? null,
    additionalLocations: record.profile.additionalLocations ?? null,
    pricingPackageInterest:
      (record.profile.pricingPackageInterest as Record<string, unknown> | null) ?? null,
    acknowledgments: (record.profile.acknowledgments as Record<string, unknown> | null) ?? null,
  };
}

function toListItem(record: NonNullable<DealerApplicationRecord>) {
  return {
    id: record.dealerApplicationId,
    dealerApplicationId: record.dealerApplicationId,
    source: record.source,
    status: record.status,
    ownerEmail: record.ownerEmail,
    submittedAt: toIso(record.submittedAt),
    approvedAt: toIso(record.approvedAt),
    rejectedAt: toIso(record.rejectedAt),
    activationSentAt: toIso(record.activationSentAt),
    activatedAt: toIso(record.activatedAt),
    dealerDealershipId: record.dealerDealershipId ?? null,
    platformApplicationId: record.platformApplicationId ?? null,
    platformDealershipId: record.platformDealershipId ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toDetail(record: NonNullable<DealerApplicationRecord>): DealerApplicationDetail {
  return {
    ...toListItem(record),
    dealerInviteId: record.dealerInviteId ?? null,
    invitedByUserId: record.invitedByUserId ?? null,
    reviewerUserId: record.reviewerUserId ?? null,
    reviewNotes: record.reviewNotes ?? null,
    rejectionReason: record.rejectionReason ?? null,
    profile: toProfile(record),
  };
}

function normalizeSyncPayload(payload: DealerApplicationSyncPayload): DealerApplicationSyncInput {
  return {
    dealerApplicationId: payload.dealerApplicationId,
    source: payload.source,
    status: payload.status,
    ownerEmail: payload.ownerEmail,
    dealerInviteId: payload.dealerInviteId ?? null,
    invitedByUserId: payload.invitedByUserId ?? null,
    dealerDealershipId: payload.dealerDealershipId ?? null,
    platformApplicationId: payload.platformApplicationId ?? null,
    platformDealershipId: payload.platformDealershipId ?? null,
    submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : null,
    approvedAt: payload.approvedAt ? new Date(payload.approvedAt) : null,
    rejectedAt: payload.rejectedAt ? new Date(payload.rejectedAt) : null,
    activationSentAt: payload.activationSentAt ? new Date(payload.activationSentAt) : null,
    activatedAt: payload.activatedAt ? new Date(payload.activatedAt) : null,
    reviewerUserId: payload.reviewerUserId ?? null,
    reviewNotes: payload.reviewNotes ?? null,
    rejectionReason: payload.rejectionReason ?? null,
    createdAt: new Date(payload.createdAt),
    updatedAt: new Date(payload.updatedAt),
    profile:
      payload.profile === undefined
        ? undefined
        : {
            businessInfo: payload.profile?.businessInfo ?? null,
            ownerInfo: payload.profile?.ownerInfo ?? null,
            primaryContact: payload.profile?.primaryContact ?? null,
            additionalLocations: payload.profile?.additionalLocations ?? null,
            pricingPackageInterest: payload.profile?.pricingPackageInterest ?? null,
            acknowledgments: payload.profile?.acknowledgments ?? null,
          },
  };
}

export async function syncDealerApplicationFromDealer(payload: DealerApplicationSyncPayload) {
  const record = await upsertDealerApplication(normalizeSyncPayload(payload));
  return {
    id: record.id,
    dealerApplicationId: record.dealerApplicationId,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listPlatformDealerApplications(input: {
  limit: number;
  offset: number;
  status?: DealerApplicationPatchRequest["status"];
  source?: DealerApplicationSyncPayload["source"];
}): Promise<DealerApplicationsListResponse> {
  const { data, total } = await listDealerApplications({
    limit: input.limit,
    offset: input.offset,
    status: input.status,
    source: input.source,
  });

  return {
    data: data.map((record) => toListItem(record)),
    meta: { total, limit: input.limit, offset: input.offset },
  };
}

export async function getPlatformDealerApplication(dealerApplicationId: string) {
  const record = await getDealerApplicationByDealerId(dealerApplicationId);
  return record ? toDetail(record) : null;
}

export class DealerApplicationNotFoundError extends Error {
  constructor(public readonly dealerApplicationId: string) {
    super("Dealer application not found");
    this.name = "DealerApplicationNotFoundError";
  }
}

export async function updatePlatformDealerApplicationReview(
  dealerApplicationId: string,
  patch: DealerApplicationPatchRequest,
  actorUserId: string
) {
  const current = await getDealerApplicationByDealerId(dealerApplicationId);
  if (!current) {
    throw new DealerApplicationNotFoundError(dealerApplicationId);
  }

  const now = new Date();
  const updateData = {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.platformApplicationId !== undefined ? { platformApplicationId: patch.platformApplicationId } : {}),
    ...(patch.platformDealershipId !== undefined ? { platformDealershipId: patch.platformDealershipId } : {}),
    ...(patch.dealerDealershipId !== undefined ? { dealerDealershipId: patch.dealerDealershipId } : {}),
    ...(patch.reviewerUserId !== undefined ? { reviewerUserId: patch.reviewerUserId } : {}),
    ...(patch.reviewNotes !== undefined ? { reviewNotes: patch.reviewNotes } : {}),
    ...(patch.rejectionReason !== undefined ? { rejectionReason: patch.rejectionReason } : {}),
    ...(patch.status === "approved" ? { approvedAt: now } : {}),
    ...(patch.status === "rejected" ? { rejectedAt: now } : {}),
    ...(patch.status === "activation_sent" ? { activationSentAt: now } : {}),
    ...(patch.status === "activated" ? { activatedAt: now } : {}),
  };

  const updated = await updateDealerApplicationByDealerId(dealerApplicationId, updateData);

  const compatibilitySync = await callDealerApplicationStateSync(
    dealerApplicationId,
    {
      status: patch.status,
      dealershipId: patch.dealerDealershipId,
      platformApplicationId: patch.platformApplicationId,
      platformDealershipId: patch.platformDealershipId,
      reviewerUserId: patch.reviewerUserId,
      reviewNotes: patch.reviewNotes,
      rejectionReason: patch.rejectionReason,
    },
    { requestId: `platform-dealer-app-sync-${dealerApplicationId}-${Date.now()}` }
  );

  if (!compatibilitySync.ok) {
    throw new Error(
      `Dealer application compatibility sync failed: ${compatibilitySync.error.status} ${compatibilitySync.error.message}`
    );
  }

  await platformAuditLog({
    actorPlatformUserId: actorUserId,
    action: "dealer_application.review_updated",
    targetType: "dealer_application",
    targetId: updated.id,
    beforeState: {
      status: current.status,
      reviewNotes: current.reviewNotes,
      rejectionReason: current.rejectionReason,
      platformDealershipId: current.platformDealershipId,
    },
    afterState: {
      status: updated.status,
      reviewNotes: updated.reviewNotes,
      rejectionReason: updated.rejectionReason,
      platformDealershipId: updated.platformDealershipId,
    },
  });

  return toDetail(updated);
}
