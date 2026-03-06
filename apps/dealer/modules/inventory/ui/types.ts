/** Vehicle list/detail response from API. Canonical cents are strings. */
export interface VehicleResponse {
  id: string;
  dealershipId: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  stockNumber: string;
  mileage: number | null;
  color: string | null;
  status: string;
  /** Canonical: sale price in cents (string). */
  salePriceCents?: string;
  auctionCostCents?: string;
  transportCostCents?: string;
  reconCostCents?: string;
  miscCostCents?: string;
  /** Read-only; computed by API. */
  projectedGrossCents?: string;
  /** @deprecated Use salePriceCents. TODO: remove fallback after Step 4. */
  listPriceCents?: string;
  /** @deprecated Use auctionCostCents. TODO: remove fallback after Step 4. */
  purchasePriceCents?: string;
  /** @deprecated Use reconCostCents. TODO: remove fallback after Step 4. */
  reconditioningCostCents?: string;
  /** @deprecated Use miscCostCents. TODO: remove fallback after Step 4. */
  otherCostsCents?: string;
  locationId: string | null;
  location?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** From GET /api/inventory/[id] when intelligence is returned. */
export interface VehicleIntelligence {
  priceToMarket: {
    marketStatus: string;
    marketDeltaCents: number | null;
    marketDeltaPercent: number | null;
    sourceLabel: string;
  };
  daysToTurn: {
    daysInStock: number | null;
    agingBucket: string | null;
    targetDays: number;
    turnRiskStatus: string;
  };
}

export interface VehicleDetailResponse extends VehicleResponse {
  photos?: VehiclePhotoResponse[];
  intelligence?: VehicleIntelligence;
}

/** Canonical inventory photo shape (GET [id] and GET [id]/photos). */
export interface VehiclePhotoResponse {
  id: string;
  fileObjectId?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder?: number;
  isPrimary?: boolean;
  createdAt: string;
}

/** Photo item from GET /api/inventory/[id]/photos (includes order and primary). */
export interface VehiclePhotoListResponse extends VehiclePhotoResponse {
  fileObjectId?: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface InventoryListResponse {
  data: VehicleResponse[];
  meta: { total: number; limit: number; offset: number };
}

export type VehicleStatus =
  | "AVAILABLE"
  | "HOLD"
  | "SOLD"
  | "WHOLESALE"
  | "REPAIR"
  | "ARCHIVED";

export const VEHICLE_STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "HOLD", label: "Hold" },
  { value: "SOLD", label: "Sold" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "REPAIR", label: "Repair" },
  { value: "ARCHIVED", label: "Archived" },
];

export interface LocationOption {
  id: string;
  name: string;
}

export interface VinDecodeResponse {
  data: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    [key: string]: string | number | undefined;
  };
}

/** GET /api/inventory/[id]/vin?latestOnly=true — single latest decode. */
export interface VinLatestResponse {
  data: {
    vin: string | null;
    decoded: {
      id: string;
      decodedAt: string;
      vin: string;
      make: string | null;
      model: string | null;
      year: number | null;
      trim: string | null;
      bodyStyle: string | null;
      engine: string | null;
      drivetrain: string | null;
      transmission: string | null;
      fuelType: string | null;
      manufacturedIn: string | null;
      rawJson: unknown;
    } | null;
  };
}

/** GET /api/inventory/[id]/valuations — list. */
export interface ValuationSnapshot {
  id: string;
  source: string;
  valueCents: number;
  capturedAt: string;
  condition?: string | null;
  odometer?: number | null;
}
export interface ValuationsListResponse {
  data: ValuationSnapshot[];
  meta: { total: number; limit: number; offset: number };
}

/** GET /api/inventory/[id]/recon. */
export type ReconStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
export interface ReconLineItem {
  id: string;
  description: string;
  costCents: number;
  category: string | null;
  sortOrder: number;
}
export interface ReconResponse {
  id: string;
  vehicleId: string;
  status: ReconStatus;
  dueDate: string | null;
  totalCents: number;
  lineItems: ReconLineItem[];
}
export interface ReconGetResponse {
  data: ReconResponse | null;
}

/** GET /api/inventory/[id]/floorplan. */
export interface FloorplanCurtailment {
  id: string;
  amountCents: number;
  paidAt: string;
}
export interface FloorplanResponse {
  id: string;
  vehicleId: string;
  lenderId: string;
  lenderName?: string;
  principalCents: number;
  aprBps: number;
  startDate: string;
  nextCurtailmentDueDate: string | null;
  curtailments: FloorplanCurtailment[];
  payoffQuoteCents: number | null;
  payoffQuoteExpiresAt: string | null;
}
export interface FloorplanGetResponse {
  data: FloorplanResponse | null;
}

export interface AgingRow {
  vehicleId: string;
  stockNumber: string;
  year: number | null;
  make: string | null;
  model: string | null;
  status: string;
  /** Canonical. API returns salePriceCents (string). */
  salePriceCents?: string;
  /** @deprecated Use salePriceCents. TODO: remove fallback after Step 4. */
  listPriceCents?: string;
  createdAt: string;
  daysInStock: number;
}

export interface AgingListResponse {
  data: AgingRow[];
  meta: { total: number; limit: number; offset: number };
}

/**
 * Get displayable sale price cents from vehicle. Prefer canonical salePriceCents; fallback to deprecated listPriceCents.
 * TODO: remove fallback after Step 4.
 */
export function getSalePriceCents(v: { salePriceCents?: string; listPriceCents?: string }): string {
  if (v.salePriceCents != null && v.salePriceCents !== "") return v.salePriceCents;
  if (v.listPriceCents != null && v.listPriceCents !== "") return v.listPriceCents;
  return "";
}

/**
 * Get displayable auction cost cents. Prefer canonical; fallback to deprecated.
 * TODO: remove fallback after Step 4.
 */
export function getAuctionCostCents(v: { auctionCostCents?: string; purchasePriceCents?: string }): string {
  if (v.auctionCostCents != null && v.auctionCostCents !== "") return v.auctionCostCents;
  if (v.purchasePriceCents != null && v.purchasePriceCents !== "") return v.purchasePriceCents;
  return "";
}

/**
 * Get displayable recon cost cents. Prefer canonical; fallback to deprecated.
 * TODO: remove fallback after Step 4.
 */
export function getReconCostCents(v: { reconCostCents?: string; reconditioningCostCents?: string }): string {
  if (v.reconCostCents != null && v.reconCostCents !== "") return v.reconCostCents;
  if (v.reconditioningCostCents != null && v.reconditioningCostCents !== "") return v.reconditioningCostCents;
  return "";
}

/**
 * Get displayable misc cost cents. Prefer canonical; fallback to deprecated.
 * TODO: remove fallback after Step 4.
 */
export function getMiscCostCents(v: { miscCostCents?: string; otherCostsCents?: string }): string {
  if (v.miscCostCents != null && v.miscCostCents !== "") return v.miscCostCents;
  if (v.otherCostsCents != null && v.otherCostsCents !== "") return v.otherCostsCents;
  return "";
}
