/**
 * Finance application and submission types — aligned with API response shapes.
 * Money fields are string cents from API; APR as integer BPS.
 * Do not change without backend/Architect alignment.
 */

export type FinanceApplicationStatus = "DRAFT" | "COMPLETED";

export type FinanceApplicantRole = "PRIMARY" | "CO";

export type FinanceSubmissionStatus =
  | "DRAFT"
  | "READY_TO_SUBMIT"
  | "SUBMITTED"
  | "DECISIONED"
  | "FUNDED"
  | "CANCELED";

export type FinanceDecisionStatus =
  | "APPROVED"
  | "CONDITIONAL"
  | "DECLINED"
  | "PENDING";

export type FinanceFundingStatus = "PENDING" | "FUNDED" | "CANCELED";

export type FinanceStipulationType =
  | "PAYSTUB"
  | "PROOF_RESIDENCE"
  | "INSURANCE"
  | "LICENSE"
  | "BANK_STATEMENT"
  | "OTHER";

export type FinanceStipulationStatus = "REQUESTED" | "RECEIVED" | "WAIVED";

export interface FinanceApplicant {
  id: string;
  dealershipId: string;
  applicationId: string;
  role: FinanceApplicantRole;
  fullName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  employerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceApplication {
  id: string;
  dealershipId: string;
  dealId: string;
  status: FinanceApplicationStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  applicants?: FinanceApplicant[];
}

export interface FinanceSubmission {
  id: string;
  dealershipId: string;
  applicationId: string;
  dealId: string;
  lenderId: string;
  lender?: { id: string; name: string };
  status: FinanceSubmissionStatus;
  submittedAt: string | null;
  decisionedAt: string | null;
  fundedAt: string | null;
  amountFinancedCents: string;
  termMonths: number;
  aprBps: number;
  paymentCents: string;
  productsTotalCents: string;
  backendGrossCents: string;
  reserveEstimateCents: string | null;
  decisionStatus: FinanceDecisionStatus | null;
  approvedTermMonths: number | null;
  approvedAprBps: number | null;
  approvedPaymentCents: string | null;
  maxAdvanceCents: string | null;
  decisionNotes: string | null;
  fundingStatus: FinanceFundingStatus;
  fundedAmountCents: string | null;
  reserveFinalCents: string | null;
  createdAt: string;
  updatedAt: string;
  stipulations?: FinanceStipulation[];
}

export interface FinanceStipulation {
  id: string;
  dealershipId: string;
  submissionId: string;
  stipType: FinanceStipulationType;
  status: FinanceStipulationStatus;
  requestedAt: string | null;
  receivedAt: string | null;
  documentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Valid next statuses for PATCH submission (status). FUNDED is only set via funding endpoint. */
export const SUBMISSION_STATUS_NEXT: Record<
  FinanceSubmissionStatus,
  FinanceSubmissionStatus[]
> = {
  DRAFT: ["READY_TO_SUBMIT", "CANCELED"],
  READY_TO_SUBMIT: ["SUBMITTED", "CANCELED"],
  SUBMITTED: ["DECISIONED", "CANCELED"],
  DECISIONED: ["CANCELED"],
  FUNDED: ["CANCELED"],
  CANCELED: [],
};

export const STIP_TYPE_OPTIONS: { value: FinanceStipulationType; label: string }[] = [
  { value: "PAYSTUB", label: "Paystub" },
  { value: "PROOF_RESIDENCE", label: "Proof of Residence" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "LICENSE", label: "License" },
  { value: "BANK_STATEMENT", label: "Bank Statement" },
  { value: "OTHER", label: "Other" },
];

export const STIP_STATUS_OPTIONS: { value: FinanceStipulationStatus; label: string }[] = [
  { value: "REQUESTED", label: "Requested" },
  { value: "RECEIVED", label: "Received" },
  { value: "WAIVED", label: "Waived" },
];

export const DECISION_STATUS_OPTIONS: { value: FinanceDecisionStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "CONDITIONAL", label: "Conditional" },
  { value: "DECLINED", label: "Declined" },
];

export const FUNDING_STATUS_OPTIONS: { value: FinanceFundingStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "FUNDED", label: "Funded" },
  { value: "CANCELED", label: "Canceled" },
];
