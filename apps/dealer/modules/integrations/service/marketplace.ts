/**
 * Marketplace feed generator: Facebook Marketplace and AutoTrader-compatible JSON.
 * Uses inventory service for vehicle data; no direct DB access.
 */
import * as inventoryService from "@/modules/inventory/service/vehicle";

type FeedVehicleRow = Awaited<ReturnType<typeof inventoryService.getFeedVehicles>>[number];

const PHOTO_BASE_URL = process.env.INVENTORY_FEED_PHOTO_BASE_URL ?? "";

function buildDescription(v: FeedVehicleRow): string {
  const parts = [v.year, v.make, v.model, v.trim].filter(Boolean);
  return parts.join(" ") || v.stockNumber || "";
}

function photoUrl(path: string): string {
  if (!PHOTO_BASE_URL) return path;
  const base = PHOTO_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export type FeedFormat = "facebook" | "autotrader";

export type FeedItem = {
  id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  description: string;
  price: string;
  priceCents: string;
  photos: Array<{ url: string; fileObjectId: string }>;
  stockNumber: string;
  mileage: number | null;
};

/** Build feed payload for the given format. Same shape for both; format can extend with format-specific fields later. */
export async function buildFeed(
  dealershipId: string,
  format: FeedFormat,
  options: { limit?: number } = {}
): Promise<{ items: FeedItem[]; format: FeedFormat }> {
  const limit = Math.min(options.limit ?? 100, 500);
  const vehicles = await inventoryService.getFeedVehicles(dealershipId, limit);

  const items: FeedItem[] = vehicles.map((v) => ({
    id: v.id,
    vin: v.vin,
    year: v.year,
    make: v.make,
    model: v.model,
    description: buildDescription(v),
    price: (Number(v.salePriceCents) / 100).toFixed(2),
    priceCents: String(v.salePriceCents),
    photos: v.vehiclePhotos.map((p) => ({
      url: photoUrl(p.fileObject.path),
      fileObjectId: p.fileObjectId,
    })),
    stockNumber: v.stockNumber,
    mileage: v.mileage,
  }));

  return { items, format };
}
