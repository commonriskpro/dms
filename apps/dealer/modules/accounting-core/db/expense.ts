import { prisma } from "@/lib/db";
import type { DealershipExpenseStatus } from "@prisma/client";

export type CreateExpenseInput = {
  dealershipId: string;
  vehicleId?: string | null;
  dealId?: string | null;
  category: string;
  vendor?: string | null;
  description?: string | null;
  amountCents: bigint;
  incurredOn: Date;
  createdByUserId?: string | null;
};

export type UpdateExpenseInput = {
  vehicleId?: string | null;
  dealId?: string | null;
  category?: string;
  vendor?: string | null;
  description?: string | null;
  amountCents?: bigint;
  incurredOn?: Date;
  status?: DealershipExpenseStatus;
};

export type ListExpensesOptions = {
  status?: DealershipExpenseStatus;
  dealId?: string;
  vehicleId?: string;
  incurredFrom?: Date;
  incurredTo?: Date;
  limit: number;
  offset: number;
};

export async function createExpense(data: CreateExpenseInput) {
  return prisma.dealershipExpense.create({
    data: {
      dealershipId: data.dealershipId,
      vehicleId: data.vehicleId ?? null,
      dealId: data.dealId ?? null,
      category: data.category.slice(0, 128),
      vendor: data.vendor?.slice(0, 256) ?? null,
      description: data.description ?? null,
      amountCents: data.amountCents,
      incurredOn: data.incurredOn,
      createdByUserId: data.createdByUserId ?? null,
    },
  });
}

export async function getExpenseById(dealershipId: string, id: string) {
  return prisma.dealershipExpense.findFirst({
    where: { id, dealershipId },
  });
}

export async function listExpenses(dealershipId: string, options: ListExpensesOptions) {
  const incurredOnFilter =
    options.incurredFrom != null && options.incurredTo != null
      ? { gte: options.incurredFrom, lte: options.incurredTo }
      : options.incurredFrom != null
        ? { gte: options.incurredFrom }
        : options.incurredTo != null
          ? { lte: options.incurredTo }
          : undefined;
  const where = {
    dealershipId,
    ...(options.status != null && { status: options.status }),
    ...(options.dealId != null && { dealId: options.dealId }),
    ...(options.vehicleId != null && { vehicleId: options.vehicleId }),
    ...(incurredOnFilter != null && { incurredOn: incurredOnFilter }),
  };
  const [data, total] = await Promise.all([
    prisma.dealershipExpense.findMany({
      where,
      orderBy: { incurredOn: "desc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.dealershipExpense.count({ where }),
  ]);
  return { data, total };
}

export async function updateExpense(
  dealershipId: string,
  id: string,
  data: UpdateExpenseInput
) {
  const existing = await prisma.dealershipExpense.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.dealershipExpense.update({
    where: { id },
    data: {
      ...(data.vehicleId !== undefined && { vehicleId: data.vehicleId }),
      ...(data.dealId !== undefined && { dealId: data.dealId }),
      ...(data.category !== undefined && { category: data.category.slice(0, 128) }),
      ...(data.vendor !== undefined && { vendor: data.vendor?.slice(0, 256) ?? null }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.amountCents !== undefined && { amountCents: data.amountCents }),
      ...(data.incurredOn !== undefined && { incurredOn: data.incurredOn }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });
}
