import { prisma } from "@/lib/db";
import type { VehicleReconStatus } from "@prisma/client";

export type UpsertReconInput = {
  status?: VehicleReconStatus;
  dueDate?: Date | null;
};

export async function getByVehicleId(dealershipId: string, vehicleId: string) {
  return prisma.vehicleRecon.findFirst({
    where: { dealershipId, vehicleId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getReconById(dealershipId: string, reconId: string) {
  return prisma.vehicleRecon.findFirst({
    where: { id: reconId, dealershipId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function upsertRecon(
  dealershipId: string,
  vehicleId: string,
  data: UpsertReconInput
) {
  return prisma.vehicleRecon.upsert({
    where: { vehicleId },
    create: {
      dealershipId,
      vehicleId,
      status: data.status ?? "NOT_STARTED",
      dueDate: data.dueDate ?? null,
    },
    update: {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
    },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export type CreateLineItemInput = {
  dealershipId: string;
  reconId: string;
  description: string;
  costCents: number;
  category?: string | null;
  sortOrder?: number;
};

export async function createLineItem(data: CreateLineItemInput) {
  return prisma.vehicleReconLineItem.create({
    data: {
      dealershipId: data.dealershipId,
      reconId: data.reconId,
      description: data.description,
      costCents: data.costCents,
      category: data.category ?? undefined,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export type UpdateLineItemInput = {
  description?: string;
  costCents?: number;
  category?: string | null;
  sortOrder?: number;
};

export async function updateLineItem(
  dealershipId: string,
  lineItemId: string,
  data: UpdateLineItemInput
) {
  return prisma.vehicleReconLineItem.updateMany({
    where: { id: lineItemId, dealershipId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.costCents !== undefined && { costCents: data.costCents }),
      ...(data.category !== undefined && { category: data.category ?? null }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  });
}

export async function deleteLineItem(
  dealershipId: string,
  lineItemId: string
) {
  return prisma.vehicleReconLineItem.deleteMany({
    where: { id: lineItemId, dealershipId },
  });
}

export async function getLineItemById(
  dealershipId: string,
  lineItemId: string
) {
  return prisma.vehicleReconLineItem.findFirst({
    where: { id: lineItemId, dealershipId },
  });
}

export async function updateVehicleReconCostCents(
  dealershipId: string,
  vehicleId: string,
  reconCostCents: number
) {
  return prisma.vehicle.updateMany({
    where: { id: vehicleId, dealershipId },
    data: { reconCostCents: BigInt(reconCostCents) },
  });
}
