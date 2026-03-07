import { prisma } from "@/lib/db";
import type { TitleStatus } from "@prisma/client";
import { paginatedQuery } from "@/lib/db/paginate";
import { CUSTOMER_SUMMARY_SELECT, VEHICLE_SUMMARY_SELECT } from "@/lib/db/common-selects";

export type UpdateDealTitleInput = {
  titleStatus?: TitleStatus;
  titleNumber?: string | null;
  lienholderName?: string | null;
  lienReleasedAt?: Date | null;
  sentToDmvAt?: Date | null;
  receivedFromDmvAt?: Date | null;
  notes?: string | null;
};

export async function createDealTitleRecord(
  dealershipId: string,
  dealId: string,
  initialStatus: TitleStatus = "TITLE_PENDING"
) {
  return prisma.dealTitle.create({
    data: {
      dealershipId,
      dealId,
      titleStatus: initialStatus,
    },
  });
}

export async function getDealTitle(dealershipId: string, dealId: string) {
  return prisma.dealTitle.findFirst({
    where: { dealId, dealershipId },
  });
}

export async function updateDealTitleStatus(
  dealershipId: string,
  dealId: string,
  data: UpdateDealTitleInput
) {
  const existing = await prisma.dealTitle.findFirst({
    where: { dealId, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.titleStatus !== undefined) payload.titleStatus = data.titleStatus;
  if (data.titleNumber !== undefined) payload.titleNumber = data.titleNumber;
  if (data.lienholderName !== undefined) payload.lienholderName = data.lienholderName;
  if (data.lienReleasedAt !== undefined) payload.lienReleasedAt = data.lienReleasedAt;
  if (data.sentToDmvAt !== undefined) payload.sentToDmvAt = data.sentToDmvAt;
  if (data.receivedFromDmvAt !== undefined) payload.receivedFromDmvAt = data.receivedFromDmvAt;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.dealTitle.update({
    where: { id: existing.id },
    data: payload as Parameters<typeof prisma.dealTitle.update>[0]["data"],
  });
}

/** List deals that have a DealTitle with titleStatus != TITLE_COMPLETED. Paginated. */
export async function listTitleQueue(
  dealershipId: string,
  options: { limit: number; offset: number }
) {
  const { limit, offset } = options;
  const where = {
    dealershipId,
    deletedAt: null,
    status: "CONTRACTED" as const,
    dealTitle: {
      is: { titleStatus: { not: "TITLE_COMPLETED" as const } },
    },
  };
  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        customer: { select: CUSTOMER_SUMMARY_SELECT },
        vehicle: { select: VEHICLE_SUMMARY_SELECT },
        dealTitle: true,
      },
    }),
    prisma.deal.count({ where }),
  ]);
  return { data, total };
}
