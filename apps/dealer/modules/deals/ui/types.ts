/** Deal status from API */
export type DealStatus =
  | "DRAFT"
  | "STRUCTURED"
  | "APPROVED"
  | "CONTRACTED"
  | "CANCELED";

/** List item from GET /api/deals */
export interface DealListItem {
  id: string;
  customerId: string;
  vehicleId: string;
  status: DealStatus;
  salePriceCents: string;
  frontGrossCents: string;
  totalDueCents: string;
  createdAt: string;
  customer?: { id: string; name: string };
  vehicle?: {
    id: string;
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    stockNumber: string;
  };
}

/** Single deal from GET /api/deals/[id] */
export interface DealDetail {
  id: string;
  dealershipId: string;
  customerId: string;
  vehicleId: string;
  salePriceCents: string;
  purchasePriceCents: string;
  taxRateBps: number;
  taxCents: string;
  docFeeCents: string;
  downPaymentCents: string;
  totalFeesCents: string;
  totalDueCents: string;
  frontGrossCents: string;
  status: DealStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  customer?: { id: string; name: string };
  vehicle?: {
    id: string;
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    stockNumber: string;
  };
  fees?: DealFee[];
  trades?: DealTrade[];
}

export interface DealFee {
  id: string;
  label: string;
  amountCents: string;
  taxable: boolean;
  createdAt: string;
}

export interface DealTrade {
  id: string;
  vehicleDescription: string;
  allowanceCents: string;
  payoffCents: string;
  createdAt: string;
}

/** History entry from GET /api/deals/[id]/history */
export interface DealHistoryEntry {
  id: string;
  fromStatus: DealStatus | null;
  toStatus: DealStatus;
  changedBy: string | null;
  createdAt: string;
}

export const DEAL_STATUS_OPTIONS: { value: DealStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "STRUCTURED", label: "Structured" },
  { value: "APPROVED", label: "Approved" },
  { value: "CONTRACTED", label: "Contracted" },
  { value: "CANCELED", label: "Canceled" },
];
