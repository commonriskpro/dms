import { prisma } from "@/lib/db";
import type { FinanceApplicationStatus } from "@prisma/client";

export type FinanceApplicationCreateInput = {
  dealId: string;
  status?: FinanceApplicationStatus;
  createdBy?: string | null;
};

export type FinanceApplicationUpdateInput = {
  status?: FinanceApplicationStatus;
};

export type ListApplicationsOptions = {
  limit: number;
  offset: number;
};

export async function getApplicationById(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof prisma.financeApplication.findFirst>> | null> {
  return prisma.financeApplication.findFirst({
    where: { id, dealershipId },
    include: { applicants: true },
  });
}

export async function listApplicationsByDealId(
  dealershipId: string,
  dealId: string,
  options: ListApplicationsOptions
): Promise<{
  data: Awaited<ReturnType<typeof prisma.financeApplication.findMany>>;
  total: number;
}> {
  const where = { dealershipId, dealId };
  const [data, total] = await Promise.all([
    prisma.financeApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.financeApplication.count({ where }),
  ]);
  return { data, total };
}

export async function createApplication(
  dealershipId: string,
  data: FinanceApplicationCreateInput
): Promise<Awaited<ReturnType<typeof prisma.financeApplication.create>>> {
  return prisma.financeApplication.create({
    data: {
      dealershipId,
      dealId: data.dealId,
      status: data.status ?? "DRAFT",
      createdBy: data.createdBy ?? null,
    },
  });
}

export async function updateApplication(
  dealershipId: string,
  id: string,
  data: FinanceApplicationUpdateInput
): Promise<Awaited<ReturnType<typeof prisma.financeApplication.update>> | null> {
  const existing = await prisma.financeApplication.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.status !== undefined) payload.status = data.status;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.financeApplication.update({
    where: { id },
    data: payload as Parameters<typeof prisma.financeApplication.update>[0]["data"],
  });
}
