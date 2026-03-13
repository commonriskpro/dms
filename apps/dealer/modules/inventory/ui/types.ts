/** Vehicle list/detail response from API. Canonical cents are strings. */
export interface VehicleResponse {
  id: string;
  dealershipId: string;
  isDraft?: boolean;
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
  /** Read-only; computed by API (ledger-derived). */
  projectedGrossCents?: string;
  /** Read-only; ledger-derived total invested (API may send; else sum breakdown). */
  totalInvestedCents?: string;
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

/**
 * Get displayable transport cost cents from vehicle/response.
 */
export function transportCostCents(v: { transportCostCents?: string }): string {
  return v.transportCostCents != null && v.transportCostCents !== "" ? v.transportCostCents : "";
}

/**
 * Get displayable total invested cents (ledger-derived). Prefer totalInvestedCents from API; else sum breakdown.
 */
export function getTotalInvestedCents(v: {
  totalInvestedCents?: string;
  auctionCostCents?: string;
  transportCostCents?: string;
  reconCostCents?: string;
  miscCostCents?: string;
}): string {
  if (v.totalInvestedCents != null && v.totalInvestedCents !== "") return v.totalInvestedCents;
  const a = v.auctionCostCents != null && v.auctionCostCents !== "" ? BigInt(v.auctionCostCents) : BigInt(0);
  const t = v.transportCostCents != null && v.transportCostCents !== "" ? BigInt(v.transportCostCents) : BigInt(0);
  const r = v.reconCostCents != null && v.reconCostCents !== "" ? BigInt(v.reconCostCents) : BigInt(0);
  const m = v.miscCostCents != null && v.miscCostCents !== "" ? BigInt(v.miscCostCents) : BigInt(0);
  const sum = a + t + r + m;
  return sum > BigInt(0) ? String(sum) : "";
}

/**
 * Get displayable projected gross cents (sale − total invested). Prefer API projectedGrossCents.
 */
export function getProjectedGrossCents(v: {
  projectedGrossCents?: string;
  salePriceCents?: string;
  listPriceCents?: string;
  totalInvestedCents?: string;
  auctionCostCents?: string;
  transportCostCents?: string;
  reconCostCents?: string;
  miscCostCents?: string;
}): string {
  if (v.projectedGrossCents != null && v.projectedGrossCents !== "") return v.projectedGrossCents;
  const sale = getSalePriceCents(v);
  const invested = getTotalInvestedCents(v);
  if (sale === "" || invested === "") return "";
  return String(BigInt(sale) - BigInt(invested));
}

// --- Vehicle Cost Ledger (V1) ---

/** GET /api/inventory/[id]/cost — ledger-derived totals only. */
export interface VehicleCostTotalsResponse {
  data: {
    vehicleId: string;
    auctionCostCents: string;
    transportCostCents: string;
    reconCostCents: string;
    miscCostCents: string;
    totalCostCents: string;
    acquisitionSubtotalCents: string;
    reconSubtotalCents: string;
    feesSubtotalCents: string;
    totalInvestedCents: string;
  };
}

/** GET /api/inventory/[id]/cost-entries — list. */
export type VehicleCostCategory =
  | "acquisition"
  | "auction_fee"
  | "transport"
  | "title_fee"
  | "doc_fee"
  | "recon_parts"
  | "recon_labor"
  | "detail"
  | "inspection"
  | "storage"
  | "misc";

export type VehicleVendorType =
  | "auction"
  | "transporter"
  | "repair"
  | "parts"
  | "detail"
  | "inspection"
  | "title_doc"
  | "other";

export const VENDOR_TYPE_LABELS: Record<VehicleVendorType, string> = {
  auction: "Auction",
  transporter: "Transport",
  repair: "Repair",
  parts: "Parts",
  detail: "Detail",
  inspection: "Inspection",
  title_doc: "Title/Doc",
  other: "Other",
};

export interface VehicleCostEntryResponse {
  id: string;
  vehicleId: string;
  description: string | null;
  category: VehicleCostCategory;
  amountCents: string;
  vendorName: string | null;
  vendorType: VehicleVendorType | null;
  occurredAt: string;
  memo: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleCostEntriesListResponse {
  data: VehicleCostEntryResponse[];
}

/** GET /api/inventory/[id]/cost-documents — list. */
export type VehicleCostDocumentKind =
  | "invoice"
  | "receipt"
  | "bill_of_sale"
  | "title_doc"
  | "other";

export interface VehicleCostDocumentResponse {
  id: string;
  vehicleId: string;
  costEntryId: string | null;
  fileObjectId: string;
  kind: VehicleCostDocumentKind;
  createdAt: string;
  createdByUserId: string | null;
  file?: {
    id: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  };
  costEntry?: {
    id: string;
    category: VehicleCostCategory;
    amountCents: string;
    occurredAt: string;
  };
}

export interface VehicleCostDocumentsListResponse {
  data: VehicleCostDocumentResponse[];
}

export const VEHICLE_COST_CATEGORY_LABELS: Record<VehicleCostCategory, string> = {
  acquisition: "Acquisition",
  auction_fee: "Auction Fee",
  transport: "Transport",
  title_fee: "Title Fee",
  doc_fee: "Doc Fee",
  recon_parts: "Recon (Parts)",
  recon_labor: "Recon (Labor)",
  detail: "Detail",
  inspection: "Inspection",
  storage: "Storage",
  misc: "Miscellaneous",
};

export const VEHICLE_COST_DOCUMENT_KIND_LABELS: Record<VehicleCostDocumentKind, string> = {
  invoice: "Invoice",
  receipt: "Receipt",
  bill_of_sale: "Bill of sale",
  title_doc: "Title doc",
  other: "Other",
};
