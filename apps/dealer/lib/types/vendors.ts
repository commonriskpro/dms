/**
 * Vendor types — aligned with API response shapes.
 */

export type VendorType =
  | "auction"
  | "transporter"
  | "repair"
  | "parts"
  | "detail"
  | "inspection"
  | "title_doc"
  | "other";

export interface Vendor {
  id: string;
  dealershipId: string;
  name: string;
  type: VendorType;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  costEntryCount?: number;
}

export interface VendorsListResponse {
  data: Vendor[];
  meta: { total: number; limit: number; offset: number };
}

export interface VendorCostEntrySummary {
  id: string;
  vehicleId: string;
  vehicleSummary: string | null;
  stockNumber: string | null;
  category: string;
  amountCents: string;
  occurredAt: string;
  memo: string | null;
}

export const VENDOR_TYPE_OPTIONS: { value: VendorType; label: string }[] = [
  { value: "auction", label: "Auction" },
  { value: "transporter", label: "Transporter" },
  { value: "repair", label: "Repair" },
  { value: "parts", label: "Parts" },
  { value: "detail", label: "Detail" },
  { value: "inspection", label: "Inspection" },
  { value: "title_doc", label: "Title / Doc" },
  { value: "other", label: "Other" },
];
