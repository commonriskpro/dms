import { prisma } from "@/lib/db";
import type { DealerApplicationSource, DealerApplicationStatus, Prisma } from "@prisma/client";

export type CreateDealerApplicationData = {
  source: DealerApplicationSource;
  status?: DealerApplicationStatus;
  invitedByUserId?: string | null;
  inviteId?: string | null;
  ownerEmail: string;
  dealershipId?: string | null;
  platformApplicationId?: string | null;
  platformDealershipId?: string | null;
};

export async function createDealerApplication(data: CreateDealerApplicationData) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.dealerApplication.create({
      data: {
        source: data.source,
        status: data.status ?? "draft",
        invitedByUserId: data.invitedByUserId ?? null,
        inviteId: data.inviteId ?? null,
        ownerEmail: data.ownerEmail.toLowerCase().trim(),
        dealershipId: data.dealershipId ?? null,
        platformApplicationId: data.platformApplicationId ?? null,
        platformDealershipId: data.platformDealershipId ?? null,
      },
    });
    await tx.dealerApplicationProfile.create({
      data: {
        applicationId: app.id,
      },
    });
    return tx.dealerApplication.findUniqueOrThrow({
      where: { id: app.id },
      include: { profile: true },
    });
  });
}

export async function getDealerApplicationById(id: string) {
  return prisma.dealerApplication.findUnique({
    where: { id },
    include: { profile: true },
  });
}

export async function getDealerApplicationByInviteId(inviteId: string) {
  return prisma.dealerApplication.findFirst({
    where: { inviteId },
    include: { profile: true },
    orderBy: { createdAt: "desc" },
  });
}

export type ListDealerApplicationsFilters = {
  status?: DealerApplicationStatus | DealerApplicationStatus[];
  source?: DealerApplicationSource;
};

export type ListDealerApplicationsPagination = {
  limit: number;
  offset: number;
};

export async function listDealerApplications(
  filters: ListDealerApplicationsFilters,
  pagination: ListDealerApplicationsPagination
) {
  const where = {
    ...(filters.status &&
      (Array.isArray(filters.status)
        ? { status: { in: filters.status } }
        : { status: filters.status })),
    ...(filters.source && { source: filters.source }),
  };
  const [data, total] = await Promise.all([
    prisma.dealerApplication.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: pagination.limit,
      skip: pagination.offset,
      include: { profile: { select: { id: true } } },
    }),
    prisma.dealerApplication.count({ where }),
  ]);
  return { data, total };
}

export type UpdateDealerApplicationData = Partial<{
  status: DealerApplicationStatus;
  dealershipId: string | null;
  platformApplicationId: string | null;
  platformDealershipId: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  activationSentAt: Date | null;
  activatedAt: Date | null;
  reviewerUserId: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
}>;

export async function updateDealerApplication(id: string, data: UpdateDealerApplicationData) {
  return prisma.dealerApplication.update({
    where: { id },
    data: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.dealershipId !== undefined && { dealershipId: data.dealershipId }),
      ...(data.platformApplicationId !== undefined && {
        platformApplicationId: data.platformApplicationId,
      }),
      ...(data.platformDealershipId !== undefined && {
        platformDealershipId: data.platformDealershipId,
      }),
      ...(data.submittedAt !== undefined && { submittedAt: data.submittedAt }),
      ...(data.approvedAt !== undefined && { approvedAt: data.approvedAt }),
      ...(data.rejectedAt !== undefined && { rejectedAt: data.rejectedAt }),
      ...(data.activationSentAt !== undefined && { activationSentAt: data.activationSentAt }),
      ...(data.activatedAt !== undefined && { activatedAt: data.activatedAt }),
      ...(data.reviewerUserId !== undefined && { reviewerUserId: data.reviewerUserId }),
      ...(data.reviewNotes !== undefined && { reviewNotes: data.reviewNotes }),
      ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason }),
    },
    include: { profile: true },
  });
}

export type UpsertDealerApplicationProfileData = Partial<{
  businessInfo: object;
  ownerInfo: object;
  primaryContact: object;
  additionalLocations: unknown;
  pricingPackageInterest: object;
  acknowledgments: object;
}>;

export async function upsertDealerApplicationProfile(
  applicationId: string,
  data: UpsertDealerApplicationProfileData
) {
  const profile = await prisma.dealerApplicationProfile.findUnique({
    where: { applicationId },
  });
  const payload: Record<string, unknown> = {};
  if (data.businessInfo !== undefined) payload.businessInfo = data.businessInfo;
  if (data.ownerInfo !== undefined) payload.ownerInfo = data.ownerInfo;
  if (data.primaryContact !== undefined) payload.primaryContact = data.primaryContact;
  if (data.additionalLocations !== undefined) payload.additionalLocations = data.additionalLocations;
  if (data.pricingPackageInterest !== undefined)
    payload.pricingPackageInterest = data.pricingPackageInterest;
  if (data.acknowledgments !== undefined) payload.acknowledgments = data.acknowledgments;

  if (profile) {
    return prisma.dealerApplicationProfile.update({
      where: { applicationId },
      data: payload as Parameters<typeof prisma.dealerApplicationProfile.update>[0]["data"],
    });
  }
  return prisma.dealerApplicationProfile.create({
    data: {
      applicationId,
      ...payload,
    } as Prisma.DealerApplicationProfileUncheckedCreateInput,
  });
}
