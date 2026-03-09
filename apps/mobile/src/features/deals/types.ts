/**
 * Deal types aligned with backend GET/POST/PATCH /api/deals.
 * Backend: apps/dealer/modules/deals/ui/types.ts, app/api/deals/serialize.ts
 */

export type DealStatus =
  | "DRAFT"
  | "STRUCTURED"
  | "APPROVED"
  | "CONTRACTED"
  | "CANCELED";

export type DealFee = {
  id: string;
  label: string;
  amountCents: string;
  taxable: boolean;
  createdAt: string;
};

export type DealTrade = {
  id: string;
  vehicleDescription: string;
  allowanceCents: string;
  payoffCents: string;
  equityCents?: string;
  createdAt: string;
};

export type DealFinanceProduct = {
  id: string;
  productType: string;
  name: string;
  priceCents: string;
  costCents: string | null;
  taxable: boolean;
  includedInAmountFinanced: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DealDetailFinance = {
  id: string;
  dealId: string;
  financingMode: string;
  termMonths: number | null;
  aprBps: number | null;
  cashDownCents: string;
  amountFinancedCents: string;
  monthlyPaymentCents: string;
  totalOfPaymentsCents: string;
  financeChargeCents: string;
  productsTotalCents: string;
  backendGrossCents: string;
  reserveCents: string | null;
  status: string;
  firstPaymentDate: string | null;
  lenderName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  products: DealFinanceProduct[];
};

export type DealDetail = {
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
  dealFinance?: DealDetailFinance | null;
};

export type DealListItem = {
  id: string;
  dealershipId: string;
  customerId: string;
  vehicleId: string;
  status: DealStatus;
  salePriceCents: string;
  totalDueCents: string;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string };
  vehicle?: {
    id: string;
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    stockNumber: string;
  };
};

export type DealHistoryEntry = {
  id: string;
  fromStatus: DealStatus | null;
  toStatus: DealStatus;
  changedBy: string | null;
  createdAt: string;
};

/** POST /api/deals */
export type CreateDealBody = {
  customerId: string;
  vehicleId: string;
  salePriceCents: string | number;
  purchasePriceCents: string | number;
  taxRateBps: number;
  docFeeCents?: string | number;
  downPaymentCents?: string | number;
  notes?: string;
  fees?: { label: string; amountCents: string | number; taxable?: boolean }[];
};

/** PATCH /api/deals/[id] */
export type UpdateDealBody = {
  salePriceCents?: string | number;
  taxRateBps?: number;
  docFeeCents?: string | number;
  downPaymentCents?: string | number;
  notes?: string | null;
};

/** PATCH /api/deals/[id]/status */
export type UpdateDealStatusBody = { status: DealStatus };

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  DRAFT: "Draft",
  STRUCTURED: "Structured",
  APPROVED: "Approved",
  CONTRACTED: "Contracted",
  CANCELED: "Canceled",
};
