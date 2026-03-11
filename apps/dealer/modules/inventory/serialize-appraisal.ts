type AppraisalLike = {
  id: string;
  vin: string;
  sourceType: string;
  vehicleId: string | null;
  appraisedBy: unknown;
  acquisitionCostCents: bigint;
  reconEstimateCents: bigint;
  transportEstimateCents: bigint;
  feesEstimateCents: bigint;
  expectedRetailCents: bigint;
  expectedWholesaleCents: bigint;
  expectedTradeInCents: bigint;
  expectedProfitCents: bigint;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle?: unknown;
} | null;

export function serializeAppraisal(row: AppraisalLike) {
  if (!row) return null;
  return {
    id: row.id,
    vin: row.vin,
    sourceType: row.sourceType,
    vehicleId: row.vehicleId,
    appraisedBy: row.appraisedBy,
    acquisitionCostCents: row.acquisitionCostCents.toString(),
    reconEstimateCents: row.reconEstimateCents.toString(),
    transportEstimateCents: row.transportEstimateCents.toString(),
    feesEstimateCents: row.feesEstimateCents.toString(),
    expectedRetailCents: row.expectedRetailCents.toString(),
    expectedWholesaleCents: row.expectedWholesaleCents.toString(),
    expectedTradeInCents: row.expectedTradeInCents.toString(),
    expectedProfitCents: row.expectedProfitCents.toString(),
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    vehicle: "vehicle" in row ? row.vehicle ?? null : null,
  };
}
