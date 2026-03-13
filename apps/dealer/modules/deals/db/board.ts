import { prisma } from "@/lib/db";
import { CUSTOMER_SUMMARY_SELECT, VEHICLE_SUMMARY_SELECT } from "@/lib/db/common-selects";

const BOARD_DEAL_INCLUDE = {
  customer: { select: CUSTOMER_SUMMARY_SELECT },
  vehicle: { select: VEHICLE_SUMMARY_SELECT },
  dealFinance: {
    where: { deletedAt: null },
    select: {
      financingMode: true,
      lenderName: true,
      status: true,
      monthlyPaymentCents: true,
      amountFinancedCents: true,
    },
  },
  dealFundings: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: {
      fundingStatus: true,
      fundingAmountCents: true,
      lenderApplication: { select: { lenderName: true } },
    },
  },
  dealTitle: {
    select: { titleStatus: true },
  },
} as const;

const BOARD_LIMIT = 50;

export async function listDeskQueue(dealershipId: string) {
  const where = {
    dealershipId,
    deletedAt: null,
    status: { in: ["DRAFT" as const, "STRUCTURED" as const, "APPROVED" as const] },
  };
  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: BOARD_LIMIT,
      include: BOARD_DEAL_INCLUDE,
    }),
    prisma.deal.count({ where }),
  ]);
  return { data, total };
}

export async function listDeliveryQueueBoard(dealershipId: string) {
  const where = {
    dealershipId,
    deletedAt: null,
    status: "CONTRACTED" as const,
    deliveryStatus: "READY_FOR_DELIVERY" as const,
  };
  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: BOARD_LIMIT,
      include: BOARD_DEAL_INCLUDE,
    }),
    prisma.deal.count({ where }),
  ]);
  return { data, total };
}

export async function listFundingQueueBoard(dealershipId: string) {
  const where = {
    dealershipId,
    deletedAt: null,
    status: "CONTRACTED" as const,
    dealFundings: {
      some: { fundingStatus: { in: ["PENDING" as const, "APPROVED" as const] } },
    },
  };
  const [data, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: BOARD_LIMIT,
      include: BOARD_DEAL_INCLUDE,
    }),
    prisma.deal.count({ where }),
  ]);
  return { data, total };
}

export async function listTitleQueueBoard(dealershipId: string) {
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
      orderBy: { updatedAt: "desc" },
      take: BOARD_LIMIT,
      include: BOARD_DEAL_INCLUDE,
    }),
    prisma.deal.count({ where }),
  ]);
  return { data, total };
}

export async function boardKpiCounts(dealershipId: string) {
  const base = { dealershipId, deletedAt: null };
  const [active, approved, contracted, grossAgg] = await Promise.all([
    prisma.deal.count({ where: { ...base, status: { not: "CANCELED" } } }),
    prisma.deal.count({ where: { ...base, status: "APPROVED" } }),
    prisma.deal.count({ where: { ...base, status: "CONTRACTED" } }),
    prisma.deal.aggregate({
      where: { ...base, status: { not: "CANCELED" } },
      _sum: { frontGrossCents: true },
    }),
  ]);
  return {
    active,
    approved,
    contracted,
    totalFrontGrossCents: String(grossAgg._sum.frontGrossCents ?? BigInt(0)),
  };
}
