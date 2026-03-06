import * as bookValuesDb from "../db/book-values";
import * as vehicleDb from "../db/vehicle";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type BookValuesInput = {
  retailCents?: number | null;
  tradeInCents?: number | null;
  wholesaleCents?: number | null;
  auctionCents?: number | null;
};

export async function getBookValues(dealershipId: string, vehicleId: string) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const row = await bookValuesDb.getByVehicleId(dealershipId, vehicleId);
  return {
    vehicleId,
    bookValues: row
      ? {
          retailCents: row.retailCents ?? undefined,
          tradeInCents: row.tradeInCents ?? undefined,
          wholesaleCents: row.wholesaleCents ?? undefined,
          auctionCents: row.auctionCents ?? undefined,
          source: row.source,
          updatedAt: row.updatedAt,
        }
      : null,
  };
}

export async function upsertBookValues(
  dealershipId: string,
  vehicleId: string,
  values: BookValuesInput,
  source: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const retailCents = values.retailCents != null ? values.retailCents : undefined;
  const tradeInCents = values.tradeInCents != null ? values.tradeInCents : undefined;
  const wholesaleCents = values.wholesaleCents != null ? values.wholesaleCents : undefined;
  const auctionCents = values.auctionCents != null ? values.auctionCents : undefined;
  if (
    (retailCents != null && retailCents < 0) ||
    (tradeInCents != null && tradeInCents < 0) ||
    (wholesaleCents != null && wholesaleCents < 0) ||
    (auctionCents != null && auctionCents < 0)
  ) {
    throw new ApiError("VALIDATION_ERROR", "Book value cents must be >= 0");
  }
  const updated = await bookValuesDb.upsertBookValues({
    dealershipId,
    vehicleId,
    retailCents: retailCents ?? null,
    tradeInCents: tradeInCents ?? null,
    wholesaleCents: wholesaleCents ?? null,
    auctionCents: auctionCents ?? null,
    source: source || "MANUAL",
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "VehicleBookValueUpdated",
    entity: "VehicleBookValue",
    entityId: updated.id,
    metadata: { vehicleId, source: updated.source },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return {
    vehicleId,
    bookValues: {
      retailCents: updated.retailCents ?? undefined,
      tradeInCents: updated.tradeInCents ?? undefined,
      wholesaleCents: updated.wholesaleCents ?? undefined,
      auctionCents: updated.auctionCents ?? undefined,
      source: updated.source,
      updatedAt: updated.updatedAt,
    },
  };
}
