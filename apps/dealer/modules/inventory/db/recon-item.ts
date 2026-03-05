import { prisma } from "@/lib/db";
import type { ReconItemStatus } from "@prisma/client";

export type ReconItemCreateInput = {
  dealershipId: string;
  vehicleId: string;
  description: string;
  costCents: number;
  status?: ReconItemStatus;
  createdByUserId?: string | null;
};

export type ReconItemUpdateInput = {
  description?: string;
  costCents?: number;
  status?: ReconItemStatus;
};

export async function listByVehicleId(
  dealershipId: string,
  vehicleId: string
) {
  return prisma.reconItem.findMany({
    where: { dealershipId, vehicleId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getById(dealershipId: string, id: string) {
  return prisma.reconItem.findFirst({
    where: { id, dealershipId },
  });
}

export async function createReconItem(data: ReconItemCreateInput) {
  return prisma.reconItem.create({
    data: {
      dealershipId: data.dealershipId,
      vehicleId: data.vehicleId,
      description: data.description,
      costCents: data.costCents,
      status: data.status ?? "PENDING",
      createdByUserId: data.createdByUserId ?? undefined,
    },
  });
}

export async function updateReconItem(
  dealershipId: string,
  id: string,
  data: ReconItemUpdateInput
) {
  const payload: { description?: string; costCents?: number; status?: ReconItemStatus; completedAt?: Date } = {};
  if (data.description !== undefined) payload.description = data.description;
  if (data.costCents !== undefined) payload.costCents = data.costCents;
  if (data.status !== undefined) {
    payload.status = data.status;
    if (data.status === "COMPLETED") payload.completedAt = new Date();
  }
  const existing = await prisma.reconItem.findFirst({
    where: { id, dealershipId },
  });
  if (!existing) return null;
  return prisma.reconItem.update({
    where: { id },
    data: payload,
  });
}

export async function getReconItem(
  dealershipId: string,
  id: string
) {
  return prisma.reconItem.findFirst({
    where: { id, dealershipId },
  });
}
