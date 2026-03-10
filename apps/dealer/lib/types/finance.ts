/**
 * Finance shell types matching API responses.
 * Money fields are string cents from API; APR as basis points.
 */

export type FinancingMode = "CASH" | "FINANCE";

export type FinanceStatus =
  | "DRAFT"
  | "STRUCTURED"
  | "PRESENTED"
  | "ACCEPTED"
  | "CONTRACTED"
  | "CANCELED";

export type ProductType =
  | "GAP"
  | "VSC"
  | "MAINTENANCE"
  | "TIRE_WHEEL"
  | "OTHER";

/** GET /api/deals/[id]/finance — money and apr as string/number from API. baseAmountCents = deal total due (for live calc). */
export interface DealFinance {
  id: string;
  dealershipId: string;
  dealId: string;
  financingMode: FinancingMode;
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
  status: FinanceStatus;
  firstPaymentDate: string | null;
  lenderName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
  /** Deal total due (cents, string). Present in GET response for client-side live calculation. */
  baseAmountCents?: string;
}

/** GET /api/deals/[id]/finance/products — priceCents/costCents as string */
export interface DealFinanceProduct {
  id: string;
  dealershipId: string;
  dealFinanceId: string;
  productType: ProductType;
  name: string;
  priceCents: string;
  costCents: string | null;
  taxable: boolean;
  includedInAmountFinanced: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

/** Allowed next status transitions (spec: DRAFT→STRUCTURED→…→CONTRACTED; any→CANCELED except CONTRACTED) */
export const FINANCE_STATUS_NEXT: Record<FinanceStatus, FinanceStatus[]> = {
  DRAFT: ["STRUCTURED", "CANCELED"],
  STRUCTURED: ["PRESENTED", "CANCELED"],
  PRESENTED: ["ACCEPTED", "CANCELED"],
  ACCEPTED: ["CONTRACTED", "CANCELED"],
  CONTRACTED: ["CANCELED"],
  CANCELED: [],
};

export const PRODUCT_TYPE_OPTIONS: ProductType[] = [
  "GAP",
  "VSC",
  "MAINTENANCE",
  "TIRE_WHEEL",
  "OTHER",
];
