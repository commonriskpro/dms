/** Serialize deal (and nested fees/trades) for API response: money fields as string. */
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
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  customer?: { id: string; name: string };
  vehicle?: { id: string; vin: string | null; year: number | null; make: string | null; model: string | null; stockNumber: string };
  fees?: { id: string; label: string; amountCents: bigint; taxable: boolean; createdAt: Date }[];
  trades?: { id: string; vehicleDescription: string; allowanceCents: bigint; payoffCents: bigint; createdAt: Date }[];
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
    notes: deal.notes,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    deletedAt: deal.deletedAt,
    deletedBy: deal.deletedBy,
    ...(deal.customer && { customer: deal.customer }),
    ...(deal.vehicle && { vehicle: deal.vehicle }),
    ...(deal.fees && { fees: deal.fees.map(serializeFee) }),
    ...(deal.trades && { trades: deal.trades.map(serializeTrade) }),
  };
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
    createdAt: fee.createdAt,
  };
}

export function serializeTrade(trade: {
  id: string;
  vehicleDescription: string;
  allowanceCents: bigint;
  payoffCents: bigint;
  createdAt: Date;
}) {
  return {
    id: trade.id,
    vehicleDescription: trade.vehicleDescription,
    allowanceCents: String(trade.allowanceCents),
    payoffCents: String(trade.payoffCents),
    createdAt: trade.createdAt,
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
