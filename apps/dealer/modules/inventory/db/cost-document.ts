import { prisma } from "@/lib/db";
import type { VehicleCostDocumentKind } from "@prisma/client";

export type CreateCostDocumentInput = {
  dealershipId: string;
  vehicleId: string;
  costEntryId?: string | null;
  fileObjectId: string;
  kind: VehicleCostDocumentKind;
  createdByUserId?: string | null;
};

/** List cost documents for a vehicle. */
export async function listCostDocumentsByVehicleId(
  dealershipId: string,
  vehicleId: string
) {
  return prisma.vehicleCostDocument.findMany({
    where: { dealershipId, vehicleId },
    orderBy: { createdAt: "desc" },
    include: {
      fileObject: {
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          path: true,
          bucket: true,
        },
      },
      costEntry: {
        select: { id: true, category: true, amountCents: true, occurredAt: true },
      },
    },
  });
}

export async function getCostDocumentById(
  dealershipId: string,
  documentId: string
) {
  return prisma.vehicleCostDocument.findFirst({
    where: { id: documentId, dealershipId },
    include: { fileObject: true },
  });
}

export async function createCostDocument(data: CreateCostDocumentInput) {
  return prisma.vehicleCostDocument.create({
    data: {
      dealershipId: data.dealershipId,
      vehicleId: data.vehicleId,
      costEntryId: data.costEntryId ?? null,
      fileObjectId: data.fileObjectId,
      kind: data.kind,
      createdByUserId: data.createdByUserId ?? null,
    },
  });
}

export async function deleteCostDocument(
  dealershipId: string,
  documentId: string
) {
  return prisma.vehicleCostDocument.deleteMany({
    where: { id: documentId, dealershipId },
  });
}
