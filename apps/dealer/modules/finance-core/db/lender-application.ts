import { prisma } from "@/lib/db";
import type { LenderApplicationStatus } from "@prisma/client";

export type LenderApplicationCreateInput = {
  dealershipId: string;
  creditApplicationId: string;
  dealId: string;
  lenderName: string;
  status?: LenderApplicationStatus;
  externalApplicationRef?: string | null;
  aprBps?: number | null;
  maxAmountCents?: bigint | null;
  maxAdvanceBps?: number | null;
  termMonths?: number | null;
  downPaymentRequiredCents?: bigint | null;
  decisionSummary?: string | null;
  rawDecisionJson?: object | null;
  submittedAt?: Date | null;
  decisionedAt?: Date | null;
  createdByUserId?: string | null;
};

export type LenderApplicationUpdateInput = Partial<
  Omit<LenderApplicationCreateInput, "dealershipId" | "creditApplicationId" | "dealId">
> & { updatedByUserId?: string | null };

export async function createLenderApplication(
  data: LenderApplicationCreateInput
) {
  return prisma.lenderApplication.create({
    data: {
      dealershipId: data.dealershipId,
      creditApplicationId: data.creditApplicationId,
      dealId: data.dealId,
      lenderName: data.lenderName,
      status: data.status ?? "DRAFT",
      externalApplicationRef: data.externalApplicationRef ?? null,
      aprBps: data.aprBps ?? null,
      maxAmountCents: data.maxAmountCents ?? null,
      maxAdvanceBps: data.maxAdvanceBps ?? null,
      termMonths: data.termMonths ?? null,
      downPaymentRequiredCents: data.downPaymentRequiredCents ?? null,
      decisionSummary: data.decisionSummary ?? null,
      rawDecisionJson: data.rawDecisionJson ?? undefined,
      submittedAt: data.submittedAt ?? null,
      decisionedAt: data.decisionedAt ?? null,
      createdByUserId: data.createdByUserId ?? null,
    },
  });
}

export async function getLenderApplicationById(
  dealershipId: string,
  id: string
) {
  return prisma.lenderApplication.findFirst({
    where: { id, dealershipId },
    include: {
      creditApplication: { select: { id: true, status: true } },
      deal: { select: { id: true, status: true } },
      stipulations: true,
    },
  });
}

export type ListLenderApplicationsOptions = {
  creditApplicationId?: string;
  dealId?: string;
  status?: LenderApplicationStatus;
  limit: number;
  offset: number;
};

export async function listLenderApplications(
  dealershipId: string,
  options: ListLenderApplicationsOptions
) {
  const where: {
    dealershipId: string;
    creditApplicationId?: string;
    dealId?: string;
    status?: LenderApplicationStatus;
  } = { dealershipId };
  if (options.creditApplicationId)
    where.creditApplicationId = options.creditApplicationId;
  if (options.dealId) where.dealId = options.dealId;
  if (options.status) where.status = options.status;

  const [data, total] = await Promise.all([
    prisma.lenderApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
      select: {
        id: true,
        creditApplicationId: true,
        dealId: true,
        lenderName: true,
        status: true,
        aprBps: true,
        maxAmountCents: true,
        termMonths: true,
        submittedAt: true,
        decisionedAt: true,
        decisionSummary: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { stipulations: true } },
      },
    }),
    prisma.lenderApplication.count({ where }),
  ]);
  return { data, total };
}

export async function updateLenderApplication(
  dealershipId: string,
  id: string,
  data: LenderApplicationUpdateInput
) {
  const existing = await prisma.lenderApplication.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  const keys: (keyof LenderApplicationUpdateInput)[] = [
    "lenderName", "status", "externalApplicationRef", "aprBps", "maxAmountCents",
    "maxAdvanceBps", "termMonths", "downPaymentRequiredCents", "decisionSummary",
    "rawDecisionJson", "submittedAt", "decisionedAt", "updatedByUserId",
  ];
  for (const k of keys) {
    if (data[k] !== undefined) (payload as Record<string, unknown>)[k] = data[k];
  }
  return prisma.lenderApplication.update({
    where: { id },
    data: payload as Parameters<typeof prisma.lenderApplication.update>[0]["data"],
  });
}
