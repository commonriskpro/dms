import { prisma } from "@/lib/db";
import type {
  LenderStipulationTypeNew,
  LenderStipulationStatusNew,
} from "@prisma/client";

export type LenderStipulationCreateInput = {
  dealershipId: string;
  lenderApplicationId: string;
  type: LenderStipulationTypeNew;
  title: string;
  notes?: string | null;
  status?: LenderStipulationStatusNew;
  requiredAt?: Date | null;
  createdByUserId?: string | null;
};

export type LenderStipulationUpdateInput = {
  title?: string;
  notes?: string | null;
  status?: LenderStipulationStatusNew;
  requiredAt?: Date | null;
  receivedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewedByUserId?: string | null;
};

export async function createLenderStipulation(
  data: LenderStipulationCreateInput
) {
  return prisma.lenderStipulation.create({
    data: {
      dealershipId: data.dealershipId,
      lenderApplicationId: data.lenderApplicationId,
      type: data.type,
      title: data.title,
      notes: data.notes ?? null,
      status: data.status ?? "REQUESTED",
      requiredAt: data.requiredAt ?? null,
      createdByUserId: data.createdByUserId ?? null,
    },
  });
}

export async function getLenderStipulationById(
  dealershipId: string,
  id: string
) {
  return prisma.lenderStipulation.findFirst({
    where: { id, dealershipId },
    include: {
      lenderApplication: {
        select: { id: true, dealId: true, lenderName: true, status: true },
      },
    },
  });
}

export async function listLenderStipulationsByLenderApplicationId(
  dealershipId: string,
  lenderApplicationId: string
) {
  return prisma.lenderStipulation.findMany({
    where: { dealershipId, lenderApplicationId },
    orderBy: [{ status: "asc" }, { requiredAt: "asc" }],
  });
}

export async function updateLenderStipulation(
  dealershipId: string,
  id: string,
  data: LenderStipulationUpdateInput
) {
  const existing = await prisma.lenderStipulation.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.lenderStipulation.update({
    where: { id },
    data: {
      title: data.title,
      notes: data.notes,
      status: data.status,
      requiredAt: data.requiredAt,
      receivedAt: data.receivedAt,
      reviewedAt: data.reviewedAt,
      reviewedByUserId: data.reviewedByUserId,
    },
  });
}
