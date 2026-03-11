type AuctionPurchaseLike = {
  id: string;
  vehicleId: string | null;
  vehicle?: unknown;
  auctionName: string;
  lotNumber: string;
  purchasePriceCents: bigint;
  feesCents: bigint;
  shippingCents: bigint;
  etaDate: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
} | null;

export function serializeAuctionPurchase(row: AuctionPurchaseLike) {
  if (!row) return null;
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehicle: "vehicle" in row ? row.vehicle ?? null : null,
    auctionName: row.auctionName,
    lotNumber: row.lotNumber,
    purchasePriceCents: row.purchasePriceCents.toString(),
    feesCents: row.feesCents.toString(),
    shippingCents: row.shippingCents.toString(),
    etaDate: row.etaDate?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
