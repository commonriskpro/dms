/** Serialize API responses: money as string cents, no BigInt in JSON. */

function bigintOrNull(v: bigint | null): string | null {
  return v != null ? String(v) : null;
}

export function serializeLender(lender: {
  id: string;
  dealershipId: string;
  name: string;
  lenderType: string;
  contactEmail: string | null;
  contactPhone: string | null;
  externalSystem: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: lender.id,
    dealershipId: lender.dealershipId,
    name: lender.name,
    lenderType: lender.lenderType,
    contactEmail: lender.contactEmail,
    contactPhone: lender.contactPhone,
    externalSystem: lender.externalSystem,
    isActive: lender.isActive,
    createdAt: lender.createdAt,
    updatedAt: lender.updatedAt,
  };
}

export function serializeFinanceApplication(app: {
  id: string;
  dealershipId: string;
  dealId: string;
  status: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  applicants?: Array<{
    id: string;
    role: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
    employerName?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) {
  return {
    id: app.id,
    dealershipId: app.dealershipId,
    dealId: app.dealId,
    status: app.status,
    createdBy: app.createdBy,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    ...(app.applicants && { applicants: app.applicants.map(serializeApplicant) }),
  };
}

export function serializeApplicant(a: {
  id: string;
  role: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  employerName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    role: a.role,
    fullName: a.fullName,
    email: a.email,
    phone: a.phone,
    addressLine1: a.addressLine1 ?? null,
    addressLine2: a.addressLine2 ?? null,
    city: a.city ?? null,
    region: a.region ?? null,
    postalCode: a.postalCode ?? null,
    country: a.country ?? null,
    employerName: a.employerName ?? null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export function serializeFinanceSubmission(sub: {
  id: string;
  dealershipId: string;
  applicationId: string;
  dealId: string;
  lenderId: string;
  status: string;
  submittedAt: Date | null;
  decisionedAt: Date | null;
  fundedAt: Date | null;
  amountFinancedCents: bigint;
  termMonths: number;
  aprBps: number;
  paymentCents: bigint;
  productsTotalCents: bigint;
  backendGrossCents: bigint;
  reserveEstimateCents: bigint | null;
  decisionStatus: string | null;
  approvedTermMonths: number | null;
  approvedAprBps: number | null;
  approvedPaymentCents: bigint | null;
  maxAdvanceCents: bigint | null;
  decisionNotes: string | null;
  fundingStatus: string;
  fundedAmountCents: bigint | null;
  reserveFinalCents: bigint | null;
  createdAt: Date;
  updatedAt: Date;
  stipulations?: Array<{
    id: string;
    stipType: string;
    status: string;
    requestedAt: Date | null;
    receivedAt: Date | null;
    documentId: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}) {
  return {
    id: sub.id,
    dealershipId: sub.dealershipId,
    applicationId: sub.applicationId,
    dealId: sub.dealId,
    lenderId: sub.lenderId,
    status: sub.status,
    submittedAt: sub.submittedAt,
    decisionedAt: sub.decisionedAt,
    fundedAt: sub.fundedAt,
    amountFinancedCents: String(sub.amountFinancedCents),
    termMonths: sub.termMonths,
    aprBps: sub.aprBps,
    paymentCents: String(sub.paymentCents),
    productsTotalCents: String(sub.productsTotalCents),
    backendGrossCents: String(sub.backendGrossCents),
    reserveEstimateCents: bigintOrNull(sub.reserveEstimateCents),
    decisionStatus: sub.decisionStatus,
    approvedTermMonths: sub.approvedTermMonths,
    approvedAprBps: sub.approvedAprBps,
    approvedPaymentCents: bigintOrNull(sub.approvedPaymentCents),
    maxAdvanceCents: bigintOrNull(sub.maxAdvanceCents),
    decisionNotes: sub.decisionNotes,
    fundingStatus: sub.fundingStatus,
    fundedAmountCents: bigintOrNull(sub.fundedAmountCents),
    reserveFinalCents: bigintOrNull(sub.reserveFinalCents),
    createdAt: sub.createdAt,
    updatedAt: sub.updatedAt,
    ...(sub.stipulations && { stipulations: sub.stipulations.map(serializeStipulation) }),
  };
}

export function serializeStipulation(s: {
  id: string;
  stipType: string;
  status: string;
  requestedAt: Date | null;
  receivedAt: Date | null;
  documentId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    stipType: s.stipType,
    status: s.status,
    requestedAt: s.requestedAt,
    receivedAt: s.receivedAt,
    documentId: s.documentId,
    notes: s.notes,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}
