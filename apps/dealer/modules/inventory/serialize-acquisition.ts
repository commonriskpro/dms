type AcquisitionAppraisal = {
  id: string;
  vin: string | null;
  status: string;
  expectedRetailCents?: bigint;
  expectedProfitCents?: bigint;
  vehicleId?: string | null;
} | null;

type AcquisitionLeadLike = {
  id: string;
  vin: string;
  sourceType: string;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  askingPriceCents: bigint | null;
  negotiatedPriceCents: bigint | null;
  status: string;
  appraisalId: string | null;
  appraisal: AcquisitionAppraisal | unknown;
  createdAt: Date;
  updatedAt: Date;
} | null;

export function serializeAcquisitionAppraisal(appraisal: AcquisitionAppraisal) {
  if (!appraisal) return null;
  return {
    id: appraisal.id,
    vin: appraisal.vin,
    status: appraisal.status,
    expectedRetailCents: appraisal.expectedRetailCents?.toString() ?? null,
    expectedProfitCents: appraisal.expectedProfitCents?.toString() ?? null,
    vehicleId: appraisal.vehicleId ?? null,
  };
}

export function serializeAcquisitionLead(row: AcquisitionLeadLike) {
  if (!row) return null;
  return {
    id: row.id,
    vin: row.vin,
    sourceType: row.sourceType,
    sellerName: row.sellerName,
    sellerPhone: row.sellerPhone,
    sellerEmail: row.sellerEmail,
    askingPriceCents: row.askingPriceCents?.toString() ?? null,
    negotiatedPriceCents: row.negotiatedPriceCents?.toString() ?? null,
    status: row.status,
    appraisalId: row.appraisalId,
    appraisal: serializeAcquisitionAppraisal(
      row.appraisal as Parameters<typeof serializeAcquisitionAppraisal>[0]
    ),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

