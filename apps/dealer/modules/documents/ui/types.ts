/**
 * Document types for UI — aligned with API response shapes.
 * Do not change without backend/Architect alignment.
 */

export const DOC_TYPES = [
  "BUYERS_ORDER",
  "CONTRACT",
  "TITLE",
  "ODOMETER",
  "STIP_INCOME",
  "STIP_RESIDENCE",
  "STIP_INSURANCE",
  "PAYOFF",
  "OTHER",
] as const;

export type DocType = (typeof DOC_TYPES)[number];

export interface DocumentItem {
  id: string;
  bucket?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  docType: string | null;
  title: string | null;
  tags: string[];
  createdAt: string;
  uploadedBy?: string;
}

export interface DocumentsListResponse {
  data: DocumentItem[];
  meta: { total: number; limit: number; offset: number };
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: string;
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  BUYERS_ORDER: "Buyer's Order",
  CONTRACT: "Contract",
  TITLE: "Title",
  ODOMETER: "Odometer",
  STIP_INCOME: "Stip – Income",
  STIP_RESIDENCE: "Stip – Residence",
  STIP_INSURANCE: "Stip – Insurance",
  PAYOFF: "Payoff",
  OTHER: "Other",
};

export function getDocTypeLabel(value: string | null): string {
  if (!value) return "—";
  return DOC_TYPE_LABELS[value] ?? value;
}
