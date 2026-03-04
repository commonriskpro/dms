import { prisma } from "@/lib/db";
import type { FinanceStipulationType, FinanceStipulationStatus } from "@prisma/client";

export type FinanceStipulationCreateInput = {
  submissionId: string;
  stipType: FinanceStipulationType;
  status?: FinanceStipulationStatus;
  requestedAt?: Date | null;
  notes?: string | null;
};

export type FinanceStipulationUpdateInput = {
  stipType?: FinanceStipulationType;
  status?: FinanceStipulationStatus;
  requestedAt?: Date | null;
  receivedAt?: Date | null;
  documentId?: string | null;
  notes?: string | null;
};

export type ListStipulationsOptions = {
  limit: number;
  offset: number;
  status?: FinanceStipulationStatus;
  stipType?: FinanceStipulationType;
};

export async function getStipulationById(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof prisma.financeStipulation.findFirst>> | null> {
  return prisma.financeStipulation.findFirst({
    where: { id, dealershipId },
  });
}

export async function listStipulationsBySubmissionId(
  dealershipId: string,
  submissionId: string,
  options: ListStipulationsOptions
): Promise<{
  data: Awaited<ReturnType<typeof prisma.financeStipulation.findMany>>;
  total: number;
}> {
  const where = {
    dealershipId,
    submissionId,
    ...(options.status !== undefined && { status: options.status }),
    ...(options.stipType !== undefined && { stipType: options.stipType }),
  };
  const [data, total] = await Promise.all([
    prisma.financeStipulation.findMany({
      where,
      orderBy: [{ stipType: "asc" }, { createdAt: "asc" }],
      take: options.limit,
      skip: options.offset,
    }),
    prisma.financeStipulation.count({ where }),
  ]);
  return { data, total };
}

export async function createStipulation(
  dealershipId: string,
  data: FinanceStipulationCreateInput
): Promise<Awaited<ReturnType<typeof prisma.financeStipulation.create>>> {
  return prisma.financeStipulation.create({
    data: {
      dealershipId,
      submissionId: data.submissionId,
      stipType: data.stipType,
      status: data.status ?? "REQUESTED",
      requestedAt: data.requestedAt ?? null,
      notes: data.notes ?? null,
    },
  });
}

export async function updateStipulation(
  dealershipId: string,
  id: string,
  data: FinanceStipulationUpdateInput
): Promise<Awaited<ReturnType<typeof prisma.financeStipulation.update>> | null> {
  const existing = await prisma.financeStipulation.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.stipType !== undefined) payload.stipType = data.stipType;
  if (data.status !== undefined) payload.status = data.status;
  if (data.requestedAt !== undefined) payload.requestedAt = data.requestedAt;
  if (data.receivedAt !== undefined) payload.receivedAt = data.receivedAt;
  if (data.documentId !== undefined) payload.documentId = data.documentId;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.financeStipulation.update({
    where: { id },
    data: payload as Parameters<typeof prisma.financeStipulation.update>[0]["data"],
  });
}

export async function deleteStipulation(
  dealershipId: string,
  id: string
): Promise<{ id: string; submissionId: string } | null> {
  const existing = await prisma.financeStipulation.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  await prisma.financeStipulation.delete({ where: { id } });
  return { id: existing.id, submissionId: existing.submissionId };
}
