import { prisma } from "@/lib/db";
import type { LenderType, LenderExternalSystem } from "@prisma/client";

export type LenderCreateInput = {
  name: string;
  lenderType: LenderType;
  contactEmail?: string | null;
  contactPhone?: string | null;
  externalSystem: LenderExternalSystem;
  isActive?: boolean;
};

export type LenderUpdateInput = {
  name?: string;
  lenderType?: LenderType;
  contactEmail?: string | null;
  contactPhone?: string | null;
  externalSystem?: LenderExternalSystem;
  isActive?: boolean;
};

export type ListLendersOptions = {
  limit: number;
  offset: number;
  isActive?: boolean;
};

export async function getLenderById(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof prisma.lender.findFirst>> | null> {
  return prisma.lender.findFirst({
    where: { id, dealershipId },
  });
}

export async function listLenders(
  dealershipId: string,
  options: ListLendersOptions
): Promise<{ data: Awaited<ReturnType<typeof prisma.lender.findMany>>; total: number }> {
  const where = {
    dealershipId,
    ...(options.isActive !== undefined && { isActive: options.isActive }),
  };
  const [data, total] = await Promise.all([
    prisma.lender.findMany({
      where,
      orderBy: { name: "asc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.lender.count({ where }),
  ]);
  return { data, total };
}

export async function createLender(
  dealershipId: string,
  data: LenderCreateInput
): Promise<Awaited<ReturnType<typeof prisma.lender.create>>> {
  return prisma.lender.create({
    data: {
      dealershipId,
      name: data.name,
      lenderType: data.lenderType,
      contactEmail: data.contactEmail ?? null,
      contactPhone: data.contactPhone ?? null,
      externalSystem: data.externalSystem,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateLender(
  dealershipId: string,
  id: string,
  data: LenderUpdateInput
): Promise<Awaited<ReturnType<typeof prisma.lender.update>> | null> {
  const existing = await prisma.lender.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.lenderType !== undefined) payload.lenderType = data.lenderType;
  if (data.contactEmail !== undefined) payload.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) payload.contactPhone = data.contactPhone;
  if (data.externalSystem !== undefined) payload.externalSystem = data.externalSystem;
  if (data.isActive !== undefined) payload.isActive = data.isActive;
  if (Object.keys(payload).length === 0) return existing;
  return prisma.lender.update({
    where: { id },
    data: payload as Parameters<typeof prisma.lender.update>[0]["data"],
  });
}

export async function deactivateLender(
  dealershipId: string,
  id: string
): Promise<Awaited<ReturnType<typeof prisma.lender.update>> | null> {
  const existing = await prisma.lender.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.lender.update({
    where: { id },
    data: { isActive: false },
  });
}
