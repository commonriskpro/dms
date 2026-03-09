import type { DealDetail } from "@/modules/deals/ui/types";

type DealFundingSerialized = {
  id: string;
  dealId: string;
  lenderApplicationId: string | null;
  fundingStatus: string;
  fundingAmountCents: string;
  fundingDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lenderName?: string;
};

function serializeDealFundingItem(f: {
  id: string;
  dealId: string;
  lenderApplicationId: string | null;
  fundingStatus: string;
  fundingAmountCents: bigint;
  fundingDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lenderApplication?: { id: string; lenderName: string } | null;
}): DealFundingSerialized {
  return {
    id: f.id,
    dealId: f.dealId,
    lenderApplicationId: f.lenderApplicationId,
    fundingStatus: f.fundingStatus,
    fundingAmountCents: String(f.fundingAmountCents),
    fundingDate: f.fundingDate?.toISOString() ?? null,
    notes: f.notes,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    ...(f.lenderApplication && { lenderName: f.lenderApplication.lenderName }),
  };
}

/** Serialize deal (and nested fees, trades, dealFinance with products) for API/RSC: money as string, dates as ISO string. */
export function serializeDeal(deal: {
  id: string;
  dealershipId: string;
  customerId: string;
  vehicleId: string;
  salePriceCents: bigint;
  purchasePriceCents: bigint;
  taxRateBps: number;
  taxCents: bigint;
  docFeeCents: bigint;
  downPaymentCents: bigint;
  totalFeesCents: bigint;
  totalDueCents: bigint;
  frontGrossCents: bigint;
  status: string;
  deliveryStatus?: string | null;
  deliveredAt?: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  customer?: { id: string; name: string };
  vehicle?: { id: string; vin: string | null; year: number | null; make: string | null; model: string | null; stockNumber: string };
  fees?: { id: string; label: string; amountCents: bigint; taxable: boolean; createdAt: Date }[];
  trades?: { id: string; vehicleDescription: string; allowanceCents: bigint; payoffCents: bigint; createdAt: Date }[];
  dealFinance?: {
    id: string;
    dealId: string;
    financingMode: string;
    termMonths: number | null;
    aprBps: number | null;
    cashDownCents: bigint;
    amountFinancedCents: bigint;
    monthlyPaymentCents: bigint;
    totalOfPaymentsCents: bigint;
    financeChargeCents: bigint;
    productsTotalCents: bigint;
    backendGrossCents: bigint;
    reserveCents: bigint | null;
    status: string;
    firstPaymentDate: Date | null;
    lenderName: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    products: { id: string; productType: string; name: string; priceCents: bigint; costCents: bigint | null; taxable: boolean; includedInAmountFinanced: boolean; createdAt: Date; updatedAt: Date }[];
  } | null;
  dealFundings?: Array<{
    id: string;
    dealId: string;
    lenderApplicationId: string | null;
    fundingStatus: string;
    fundingAmountCents: bigint;
    fundingDate: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    lenderApplication?: { id: string; lenderName: string } | null;
  }>;
  dealTitle?: {
    id: string;
    dealId: string;
    titleStatus: string;
    titleNumber: string | null;
    lienholderName: string | null;
    lienReleasedAt: Date | null;
    sentToDmvAt: Date | null;
    receivedFromDmvAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  dealDmvChecklistItems?: Array<{
    id: string;
    dealId: string;
    label: string;
    completed: boolean;
    completedAt: Date | null;
    createdAt: Date;
  }>;
}) {
  return {
    id: deal.id,
    dealershipId: deal.dealershipId,
    customerId: deal.customerId,
    vehicleId: deal.vehicleId,
    salePriceCents: String(deal.salePriceCents),
    purchasePriceCents: String(deal.purchasePriceCents),
    taxRateBps: deal.taxRateBps,
    taxCents: String(deal.taxCents),
    docFeeCents: String(deal.docFeeCents),
    downPaymentCents: String(deal.downPaymentCents),
    totalFeesCents: String(deal.totalFeesCents),
    totalDueCents: String(deal.totalDueCents),
    frontGrossCents: String(deal.frontGrossCents),
    status: deal.status,
    ...(deal.deliveryStatus != null && { deliveryStatus: deal.deliveryStatus }),
    ...(deal.deliveredAt != null && { deliveredAt: deal.deliveredAt.toISOString() }),
    notes: deal.notes,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    deletedAt: deal.deletedAt?.toISOString() ?? null,
    deletedBy: deal.deletedBy,
    ...(deal.customer && { customer: deal.customer }),
    ...(deal.vehicle && { vehicle: deal.vehicle }),
    ...(deal.fees && { fees: deal.fees.map(serializeFee) }),
    ...(deal.trades && { trades: deal.trades.map(serializeTrade) }),
    ...(deal.dealFinance && { dealFinance: serializeDealFinanceForDeal(deal.dealFinance) }),
    ...(deal.dealFundings && { dealFundings: deal.dealFundings.map(serializeDealFundingItem) }),
    ...(deal.dealTitle && {
      dealTitle: {
        id: deal.dealTitle.id,
        dealId: deal.dealTitle.dealId,
        titleStatus: deal.dealTitle.titleStatus,
        titleNumber: deal.dealTitle.titleNumber,
        lienholderName: deal.dealTitle.lienholderName,
        lienReleasedAt: deal.dealTitle.lienReleasedAt?.toISOString() ?? null,
        sentToDmvAt: deal.dealTitle.sentToDmvAt?.toISOString() ?? null,
        receivedFromDmvAt: deal.dealTitle.receivedFromDmvAt?.toISOString() ?? null,
        notes: deal.dealTitle.notes,
        createdAt: deal.dealTitle.createdAt.toISOString(),
        updatedAt: deal.dealTitle.updatedAt.toISOString(),
      },
    }),
    ...(deal.dealDmvChecklistItems && {
      dealDmvChecklistItems: deal.dealDmvChecklistItems.map((i) => ({
        id: i.id,
        dealId: i.dealId,
        label: i.label,
        completed: i.completed,
        completedAt: i.completedAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
      })),
    }),
  };
}

/** Convert deal (from getDeal) to DealDetail for RSC → client (modal or direct page). */
export function toDealDetail(deal: Parameters<typeof serializeDeal>[0]): DealDetail {
  return serializeDeal(deal) as DealDetail;
}

export function serializeFee(fee: {
  id: string;
  label: string;
  amountCents: bigint;
  taxable: boolean;
  createdAt: Date;
}) {
  return {
    id: fee.id,
    label: fee.label,
    amountCents: String(fee.amountCents),
    taxable: fee.taxable,
    createdAt: fee.createdAt.toISOString(),
  };
}

export function serializeTrade(trade: {
  id: string;
  vehicleDescription: string;
  allowanceCents: bigint;
  payoffCents: bigint;
  createdAt: Date;
}) {
  const allowanceCents = typeof trade.allowanceCents === "bigint" ? trade.allowanceCents : BigInt(trade.allowanceCents);
  const payoffCents = typeof trade.payoffCents === "bigint" ? trade.payoffCents : BigInt(trade.payoffCents);
  const equityCents = allowanceCents - payoffCents;
  return {
    id: trade.id,
    vehicleDescription: trade.vehicleDescription,
    allowanceCents: String(trade.allowanceCents),
    payoffCents: String(trade.payoffCents),
    equityCents: String(equityCents),
    createdAt: trade.createdAt.toISOString(),
  };
}

/** Serialize dealFinance (with products) for embedding in deal payload; RSC-safe (dates ISO, money string). */
function serializeDealFinanceForDeal(finance: {
  id: string;
  dealId: string;
  financingMode: string;
  termMonths: number | null;
  aprBps: number | null;
  cashDownCents: bigint;
  amountFinancedCents: bigint;
  monthlyPaymentCents: bigint;
  totalOfPaymentsCents: bigint;
  financeChargeCents: bigint;
  productsTotalCents: bigint;
  backendGrossCents: bigint;
  reserveCents: bigint | null;
  status: string;
  firstPaymentDate: Date | null;
  lenderName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  products: { id: string; productType: string; name: string; priceCents: bigint; costCents: bigint | null; taxable: boolean; includedInAmountFinanced: boolean; createdAt: Date; updatedAt: Date }[];
}) {
  return {
    id: finance.id,
    dealId: finance.dealId,
    financingMode: finance.financingMode,
    termMonths: finance.termMonths,
    aprBps: finance.aprBps,
    cashDownCents: String(finance.cashDownCents),
    amountFinancedCents: String(finance.amountFinancedCents),
    monthlyPaymentCents: String(finance.monthlyPaymentCents),
    totalOfPaymentsCents: String(finance.totalOfPaymentsCents),
    financeChargeCents: String(finance.financeChargeCents),
    productsTotalCents: String(finance.productsTotalCents),
    backendGrossCents: String(finance.backendGrossCents),
    reserveCents: finance.reserveCents != null ? String(finance.reserveCents) : null,
    status: finance.status,
    firstPaymentDate: finance.firstPaymentDate?.toISOString().slice(0, 10) ?? null,
    lenderName: finance.lenderName,
    notes: finance.notes,
    createdAt: finance.createdAt.toISOString(),
    updatedAt: finance.updatedAt.toISOString(),
    products: finance.products.map((p) => ({
      id: p.id,
      productType: p.productType,
      name: p.name,
      priceCents: String(p.priceCents),
      costCents: p.costCents != null ? String(p.costCents) : null,
      taxable: p.taxable,
      includedInAmountFinanced: p.includedInAmountFinanced,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}

/** Serialize DealFinance for API: money and apr as string. */
export function serializeDealFinance(finance: {
  id: string;
  dealershipId: string;
  dealId: string;
  financingMode: string;
  termMonths: number | null;
  aprBps: number | null;
  cashDownCents: bigint;
  amountFinancedCents: bigint;
  monthlyPaymentCents: bigint;
  totalOfPaymentsCents: bigint;
  financeChargeCents: bigint;
  productsTotalCents: bigint;
  backendGrossCents: bigint;
  reserveCents: bigint | null;
  status: string;
  firstPaymentDate: Date | null;
  lenderName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}) {
  return {
    id: finance.id,
    dealershipId: finance.dealershipId,
    dealId: finance.dealId,
    financingMode: finance.financingMode,
    termMonths: finance.termMonths,
    aprBps: finance.aprBps,
    cashDownCents: String(finance.cashDownCents),
    amountFinancedCents: String(finance.amountFinancedCents),
    monthlyPaymentCents: String(finance.monthlyPaymentCents),
    totalOfPaymentsCents: String(finance.totalOfPaymentsCents),
    financeChargeCents: String(finance.financeChargeCents),
    productsTotalCents: String(finance.productsTotalCents),
    backendGrossCents: String(finance.backendGrossCents),
    reserveCents: finance.reserveCents != null ? String(finance.reserveCents) : null,
    status: finance.status,
    firstPaymentDate: finance.firstPaymentDate,
    lenderName: finance.lenderName,
    notes: finance.notes,
    createdAt: finance.createdAt,
    updatedAt: finance.updatedAt,
    deletedAt: finance.deletedAt,
    deletedBy: finance.deletedBy,
  };
}

/** Serialize DealFinanceProduct for API: priceCents/costCents as string. */
export function serializeDealFinanceProduct(product: {
  id: string;
  dealershipId: string;
  dealFinanceId: string;
  productType: string;
  name: string;
  priceCents: bigint;
  costCents: bigint | null;
  taxable: boolean;
  includedInAmountFinanced: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
}) {
  return {
    id: product.id,
    dealershipId: product.dealershipId,
    dealFinanceId: product.dealFinanceId,
    productType: product.productType,
    name: product.name,
    priceCents: String(product.priceCents),
    costCents: product.costCents != null ? String(product.costCents) : null,
    taxable: product.taxable,
    includedInAmountFinanced: product.includedInAmountFinanced,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    deletedAt: product.deletedAt,
    deletedBy: product.deletedBy,
  };
}

/** Serialize DealTitle for API (title routes). */
export function serializeDealTitle(t: {
  id: string;
  dealId: string;
  dealershipId: string;
  titleStatus: string;
  titleNumber: string | null;
  lienholderName: string | null;
  lienReleasedAt: Date | null;
  sentToDmvAt: Date | null;
  receivedFromDmvAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    dealId: t.dealId,
    dealershipId: t.dealershipId,
    titleStatus: t.titleStatus,
    titleNumber: t.titleNumber,
    lienholderName: t.lienholderName,
    lienReleasedAt: t.lienReleasedAt?.toISOString() ?? null,
    sentToDmvAt: t.sentToDmvAt?.toISOString() ?? null,
    receivedFromDmvAt: t.receivedFromDmvAt?.toISOString() ?? null,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Serialize single DealFunding record for API (funding routes). */
export function serializeDealFunding(f: {
  id: string;
  dealId: string;
  dealershipId: string;
  lenderApplicationId: string | null;
  fundingStatus: string;
  fundingAmountCents: bigint;
  fundingDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lenderApplication?: { id: string; lenderName: string } | null;
}) {
  return {
    id: f.id,
    dealId: f.dealId,
    dealershipId: f.dealershipId,
    lenderApplicationId: f.lenderApplicationId,
    fundingStatus: f.fundingStatus,
    fundingAmountCents: String(f.fundingAmountCents),
    fundingDate: f.fundingDate?.toISOString() ?? null,
    notes: f.notes,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    ...(f.lenderApplication && { lenderName: f.lenderApplication.lenderName }),
  };
}

/** Serialize DMV checklist item for API. */
export function serializeChecklistItem(item: {
  id: string;
  dealId: string;
  dealershipId: string;
  label: string;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: item.id,
    dealId: item.dealId,
    dealershipId: item.dealershipId,
    label: item.label,
    completed: item.completed,
    completedAt: item.completedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  };
}
