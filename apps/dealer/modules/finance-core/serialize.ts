/** Credit application DTO: never expose raw SSN; only ssnMasked (***-**-**** when present). */
export function serializeCreditApplication(row: {
  id: string;
  dealId: string | null;
  customerId: string;
  status: string;
  applicantFirstName: string;
  applicantLastName: string;
  dob: Date | null;
  ssnEncrypted: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  housingStatus: string | null;
  housingPaymentCents: bigint | null;
  yearsAtResidence: number | null;
  employerName: string | null;
  jobTitle: string | null;
  employmentYears: number | null;
  monthlyIncomeCents: bigint | null;
  otherIncomeCents: bigint | null;
  notes: string | null;
  submittedAt: Date | null;
  decisionedAt: Date | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    dealId: row.dealId,
    customerId: row.customerId,
    status: row.status,
    applicantFirstName: row.applicantFirstName,
    applicantLastName: row.applicantLastName,
    dob: row.dob?.toISOString().slice(0, 10) ?? null,
    ssnMasked: row.ssnEncrypted ? "***-**-****" : null,
    phone: row.phone,
    email: row.email,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    housingStatus: row.housingStatus,
    housingPaymentCents: row.housingPaymentCents?.toString() ?? null,
    yearsAtResidence: row.yearsAtResidence,
    employerName: row.employerName,
    jobTitle: row.jobTitle,
    employmentYears: row.employmentYears,
    monthlyIncomeCents: row.monthlyIncomeCents?.toString() ?? null,
    otherIncomeCents: row.otherIncomeCents?.toString() ?? null,
    notes: row.notes,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    decisionedAt: row.decisionedAt?.toISOString() ?? null,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** List item: no SSN at all. */
export function serializeCreditApplicationListItem(row: {
  id: string;
  dealId: string | null;
  customerId: string;
  status: string;
  applicantFirstName: string;
  applicantLastName: string;
  submittedAt: Date | null;
  decisionedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    dealId: row.dealId,
    customerId: row.customerId,
    status: row.status,
    applicantFirstName: row.applicantFirstName,
    applicantLastName: row.applicantLastName,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    decisionedAt: row.decisionedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeLenderApplication(row: {
  id: string;
  creditApplicationId: string;
  dealId: string;
  lenderName: string;
  status: string;
  externalApplicationRef: string | null;
  aprBps: number | null;
  maxAmountCents: bigint | null;
  maxAdvanceBps: number | null;
  termMonths: number | null;
  downPaymentRequiredCents: bigint | null;
  decisionSummary: string | null;
  submittedAt: Date | null;
  decisionedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { stipulations: number };
}) {
  return {
    id: row.id,
    creditApplicationId: row.creditApplicationId,
    dealId: row.dealId,
    lenderName: row.lenderName,
    status: row.status,
    externalApplicationRef: row.externalApplicationRef,
    aprBps: row.aprBps,
    maxAmountCents: row.maxAmountCents?.toString() ?? null,
    maxAdvanceBps: row.maxAdvanceBps,
    termMonths: row.termMonths,
    downPaymentRequiredCents: row.downPaymentRequiredCents?.toString() ?? null,
    decisionSummary: row.decisionSummary,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    decisionedAt: row.decisionedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    stipulationCount: row._count?.stipulations ?? 0,
  };
}

export function serializeLenderStipulation(row: {
  id: string;
  lenderApplicationId: string;
  type: string;
  title: string;
  notes: string | null;
  status: string;
  requiredAt: Date | null;
  receivedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    lenderApplicationId: row.lenderApplicationId,
    type: row.type,
    title: row.title,
    notes: row.notes,
    status: row.status,
    requiredAt: row.requiredAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeComplianceForm(row: {
  id: string;
  dealId: string;
  formType: string;
  status: string;
  generatedPayloadJson: unknown;
  generatedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const payload =
    row.generatedPayloadJson != null &&
    typeof row.generatedPayloadJson === "object" &&
    !Array.isArray(row.generatedPayloadJson)
      ? (row.generatedPayloadJson as object)
      : null;

  return {
    id: row.id,
    dealId: row.dealId,
    formType: row.formType,
    status: row.status,
    generatedPayloadJson: payload,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeDealDocument(row: {
  id: string;
  dealId: string;
  creditApplicationId: string | null;
  lenderApplicationId: string | null;
  category: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    dealId: row.dealId,
    creditApplicationId: row.creditApplicationId,
    lenderApplicationId: row.lenderApplicationId,
    category: row.category,
    title: row.title,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
