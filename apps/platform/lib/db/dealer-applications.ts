import { prisma } from "@/lib/db";
import type { Prisma, PlatformDealerApplicationSource, PlatformDealerApplicationStatus } from "../../../node_modules/.prisma/platform-client";

export type DealerApplicationProfileUpsertInput = Partial<{
  businessInfo: Record<string, unknown> | null;
  ownerInfo: Record<string, unknown> | null;
  primaryContact: Record<string, unknown> | null;
  additionalLocations: unknown;
  pricingPackageInterest: Record<string, unknown> | null;
  acknowledgments: Record<string, unknown> | null;
}>;

export type DealerApplicationSyncInput = {
  dealerApplicationId: string;
  source: PlatformDealerApplicationSource;
  status: PlatformDealerApplicationStatus;
  ownerEmail: string;
  dealerInviteId?: string | null;
  invitedByUserId?: string | null;
  dealerDealershipId?: string | null;
  platformApplicationId?: string | null;
  platformDealershipId?: string | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  activationSentAt?: Date | null;
  activatedAt?: Date | null;
  reviewerUserId?: string | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  profile?: DealerApplicationProfileUpsertInput | null;
};

export type DealerApplicationReviewPatch = Partial<{
  status: PlatformDealerApplicationStatus;
  platformApplicationId: string | null;
  platformDealershipId: string | null;
  dealerDealershipId: string | null;
  reviewerUserId: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  activationSentAt: Date | null;
  activatedAt: Date | null;
}>;

const detailInclude = {
  profile: true,
  dealership: { include: { mapping: true } },
} satisfies Prisma.PlatformDealerApplicationInclude;

export async function upsertDealerApplication(input: DealerApplicationSyncInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.platformDealerApplication.findUnique({
      where: { dealerApplicationId: input.dealerApplicationId },
      select: { id: true },
    });

    const data = {
      source: input.source,
      status: input.status,
      ownerEmail: input.ownerEmail.toLowerCase().trim(),
      dealerInviteId: input.dealerInviteId ?? null,
      invitedByUserId: input.invitedByUserId ?? null,
      dealerDealershipId: input.dealerDealershipId ?? null,
      platformApplicationId: input.platformApplicationId ?? null,
      platformDealershipId: input.platformDealershipId ?? null,
      submittedAt: input.submittedAt ?? null,
      approvedAt: input.approvedAt ?? null,
      rejectedAt: input.rejectedAt ?? null,
      activationSentAt: input.activationSentAt ?? null,
      activatedAt: input.activatedAt ?? null,
      reviewerUserId: input.reviewerUserId ?? null,
      reviewNotes: input.reviewNotes ?? null,
      rejectionReason: input.rejectionReason ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    } satisfies Prisma.PlatformDealerApplicationUncheckedCreateInput;

    const application = existing
      ? await tx.platformDealerApplication.update({
          where: { dealerApplicationId: input.dealerApplicationId },
          data,
          include: detailInclude,
        })
      : await tx.platformDealerApplication.create({
          data: {
            ...data,
            dealerApplicationId: input.dealerApplicationId,
          },
          include: detailInclude,
        });

    if (input.profile !== undefined) {
      const profilePayload: Prisma.PlatformDealerApplicationProfileUncheckedCreateInput = {
        applicationId: application.id,
        businessInfo: input.profile?.businessInfo ?? null,
        ownerInfo: input.profile?.ownerInfo ?? null,
        primaryContact: input.profile?.primaryContact ?? null,
        additionalLocations: input.profile?.additionalLocations ?? null,
        pricingPackageInterest: input.profile?.pricingPackageInterest ?? null,
        acknowledgments: input.profile?.acknowledgments ?? null,
      };

      const profileExists = await tx.platformDealerApplicationProfile.findUnique({
        where: { applicationId: application.id },
        select: { id: true },
      });

      if (profileExists) {
        await tx.platformDealerApplicationProfile.update({
          where: { applicationId: application.id },
          data: {
            businessInfo: profilePayload.businessInfo,
            ownerInfo: profilePayload.ownerInfo,
            primaryContact: profilePayload.primaryContact,
            additionalLocations: profilePayload.additionalLocations,
            pricingPackageInterest: profilePayload.pricingPackageInterest,
            acknowledgments: profilePayload.acknowledgments,
          },
        });
      } else {
        await tx.platformDealerApplicationProfile.create({ data: profilePayload });
      }
    }

    return tx.platformDealerApplication.findUniqueOrThrow({
      where: { dealerApplicationId: input.dealerApplicationId },
      include: detailInclude,
    });
  });
}

export async function listDealerApplications(options: {
  limit: number;
  offset: number;
  status?: PlatformDealerApplicationStatus;
  source?: PlatformDealerApplicationSource;
}) {
  const { limit, offset, status, source } = options;
  const where: Prisma.PlatformDealerApplicationWhereInput = {
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.platformDealerApplication.findMany({
      where,
      include: detailInclude,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.platformDealerApplication.count({ where }),
  ]);

  return { data, total };
}

export async function getDealerApplicationByDealerId(dealerApplicationId: string) {
  return prisma.platformDealerApplication.findUnique({
    where: { dealerApplicationId },
    include: detailInclude,
  });
}

export async function updateDealerApplicationByDealerId(
  dealerApplicationId: string,
  data: DealerApplicationReviewPatch
) {
  return prisma.platformDealerApplication.update({
    where: { dealerApplicationId },
    data,
    include: detailInclude,
  });
}
