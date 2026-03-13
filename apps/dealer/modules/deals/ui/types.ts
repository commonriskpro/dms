/** Deal status from API */
export type DealStatus =
  | "DRAFT"
  | "STRUCTURED"
  | "APPROVED"
  | "CONTRACTED"
  | "CANCELED";

export type DealMode = "CASH" | "FINANCE";

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

/** F&I product (from dealFinance.products) */
export interface DealFinanceProduct {
  id: string;
  productType: string;
  name: string;
  priceCents: string;
  costCents: string | null;
  taxable: boolean;
  includedInAmountFinanced: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Finance block (optional, 1:1 with deal); products are F&I products. */
export interface DealDetailFinance {
  id: string;
  dealId: string;
  financingMode: DealMode;
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
}

/** Delivery status (deal-level). */
export type DeliveryStatus = "READY_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";

/** Deal funding record (from API). */
export interface DealFundingDetail {
  id: string;
  dealId: string;
  lenderApplicationId: string | null;
  fundingStatus: "NONE" | "PENDING" | "APPROVED" | "FUNDED" | "FAILED";
  fundingAmountCents: string;
  fundingDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lenderName?: string;
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
  deliveryStatus?: DeliveryStatus | null;
  deliveredAt?: string | null;
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
  dealFundings?: DealFundingDetail[];
  dealTitle?: {
    id: string;
    dealId: string;
    titleStatus: string;
    titleNumber: string | null;
    lienholderName: string | null;
    lienReleasedAt: string | null;
    sentToDmvAt: string | null;
    receivedFromDmvAt: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  dealDmvChecklistItems?: Array<{
    id: string;
    dealId: string;
    label: string;
    completed: boolean;
    completedAt: string | null;
    createdAt: string;
  }>;
}

export function getDealMode(deal: Pick<DealDetail, "dealFinance">): DealMode {
  return deal.dealFinance?.financingMode === "CASH" ? "CASH" : "FINANCE";
}

export function isFinanceDeal(deal: Pick<DealDetail, "dealFinance">): boolean {
  return getDealMode(deal) === "FINANCE";
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
  /** Computed on read: allowanceCents - payoffCents (may be negative). */
  equityCents?: string;
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

export type StatusVariant = "info" | "success" | "warning" | "danger" | "neutral";

export function dealStatusToVariant(status: DealStatus): StatusVariant {
  switch (status) {
    case "DRAFT":
      return "neutral";
    case "STRUCTURED":
      return "info";
    case "APPROVED":
      return "warning";
    case "CONTRACTED":
      return "success";
    case "CANCELED":
      return "danger";
    default:
      return "neutral";
  }
}

/** Audit entry for Deal Desk audit panel */
export interface DealAuditEntry {
  id: string;
  entity: string;
  entityId: string | null;
  action: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
}

/** Full desk data from getDealDeskData (server-first load) */
export interface DealDeskData {
  deal: DealDetail;
  activity: DealHistoryEntry[];
  activityTotal: number;
  audit: DealAuditEntry[];
  auditTotal: number;
}
