import { prisma } from "@/lib/db";
import type {
  FinanceSubmissionStatus,
  FinanceDecisionStatus,
  FinanceFundingStatus,
} from "@prisma/client";

export type FinanceSubmissionCreateInput = {
  applicationId: string;
  dealId: string;
  lenderId: string;
  amountFinancedCents: bigint;
  termMonths: number;
  aprBps: number;
  paymentCents: bigint;
  productsTotalCents: bigint;
  backendGrossCents: bigint;
  reserveEstimateCents?: bigint | null;
};

export type FinanceSubmissionUpdateInput = {
  status?: FinanceSubmissionStatus;
  submittedAt?: Date | null;
  decisionedAt?: Date | null;
  decisionStatus?: FinanceDecisionStatus | null;
  approvedTermMonths?: number | null;
  approvedAprBps?: number | null;
  approvedPaymentCents?: bigint | null;
  maxAdvanceCents?: bigint | null;
  decisionNotes?: string | null;
  reserveEstimateCents?: bigint | null;
};

export type FinanceSubmissionFundingInput = {
  fundingStatus: FinanceFundingStatus;
  fundedAt?: Date | null;
  fundedAmountCents?: bigint | null;
  reserveFinalCents?: bigint | null;
};

export type ListSubmissionsOptions = {
  limit: number;
  offset: number;
  status?: FinanceSubmissionStatus;
};

export async function getSubmissionById(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof prisma.financeSubmission.findFirst>> | null> {
  return prisma.financeSubmission.findFirst({
    where: { id, dealershipId },
    include: { stipulations: true },
  });
}

export async function listSubmissionsByApplicationId(
  dealershipId: string,
  applicationId: string,
  options: ListSubmissionsOptions
): Promise<{
  data: Awaited<ReturnType<typeof prisma.financeSubmission.findMany>>;
  total: number;
}> {
  const where = {
    dealershipId,
    applicationId,
    ...(options.status !== undefined && { status: options.status }),
  };
  const [data, total] = await Promise.all([
    prisma.financeSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.financeSubmission.count({ where }),
  ]);
  return { data, total };
}

export async function createSubmission(
  dealershipId: string,
  data: FinanceSubmissionCreateInput
): Promise<Awaited<ReturnType<typeof prisma.financeSubmission.create>>> {
  return prisma.financeSubmission.create({
    data: {
      dealershipId,
      applicationId: data.applicationId,
      dealId: data.dealId,
      lenderId: data.lenderId,
      amountFinancedCents: data.amountFinancedCents,
      termMonths: data.termMonths,
      aprBps: data.aprBps,
      paymentCents: data.paymentCents,
      productsTotalCents: data.productsTotalCents,
      backendGrossCents: data.backendGrossCents,
      reserveEstimateCents: data.reserveEstimateCents ?? null,
    },
  });
}

export async function updateSubmission(
  dealershipId: string,
  id: string,
  data: FinanceSubmissionUpdateInput
): Promise<Awaited<ReturnType<typeof prisma.financeSubmission.update>> | null> {
  const existing = await prisma.financeSubmission.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.status !== undefined) payload.status = data.status;
  if (data.submittedAt !== undefined) payload.submittedAt = data.submittedAt;
  if (data.decisionedAt !== undefined) payload.decisionedAt = data.decisionedAt;
  if (data.decisionStatus !== undefined) payload.decisionStatus = data.decisionStatus;
  if (data.approvedTermMonths !== undefined) payload.approvedTermMonths = data.approvedTermMonths;
  if (data.approvedAprBps !== undefined) payload.approvedAprBps = data.approvedAprBps;
  if (data.approvedPaymentCents !== undefined) payload.approvedPaymentCents = data.approvedPaymentCents;
  if (data.maxAdvanceCents !== undefined) payload.maxAdvanceCents = data.maxAdvanceCents;
  if (data.decisionNotes !== undefined) payload.decisionNotes = data.decisionNotes;
  if (data.reserveEstimateCents !== undefined) payload.reserveEstimateCents = data.reserveEstimateCents;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.financeSubmission.update({
    where: { id },
    data: payload as Parameters<typeof prisma.financeSubmission.update>[0]["data"],
  });
}

export async function updateSubmissionFunding(
  dealershipId: string,
  id: string,
  data: FinanceSubmissionFundingInput
): Promise<Awaited<ReturnType<typeof prisma.financeSubmission.update>> | null> {
  const existing = await prisma.financeSubmission.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {
    fundingStatus: data.fundingStatus,
  };
  if (data.fundedAt !== undefined) payload.fundedAt = data.fundedAt;
  if (data.fundedAmountCents !== undefined) payload.fundedAmountCents = data.fundedAmountCents;
  if (data.reserveFinalCents !== undefined) payload.reserveFinalCents = data.reserveFinalCents;
  if (data.fundingStatus === "FUNDED" && !existing.fundedAt) {
    payload.fundedAt = data.fundedAt ?? new Date();
  }
  if (data.fundingStatus === "FUNDED") {
    (payload as Record<string, unknown>).status = "FUNDED";
  }
  return prisma.financeSubmission.update({
    where: { id },
    data: payload as Parameters<typeof prisma.financeSubmission.update>[0]["data"],
  });
}
