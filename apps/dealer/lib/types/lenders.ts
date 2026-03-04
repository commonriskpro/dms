/**
 * Lender directory types — aligned with API response shapes.
 * Do not change without backend/Architect alignment.
 */

export type LenderType = "BANK" | "CREDIT_UNION" | "CAPTIVE" | "OTHER";

export type LenderExternalSystem =
  | "NONE"
  | "ROUTEONE"
  | "DEALERTRACK"
  | "CUDL"
  | "OTHER";

export interface Lender {
  id: string;
  dealershipId: string;
  name: string;
  lenderType: LenderType;
  contactEmail: string | null;
  contactPhone: string | null;
  externalSystem: LenderExternalSystem;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LendersListResponse {
  data: Lender[];
  meta: { total: number; limit: number; offset: number };
}

export const LENDER_TYPE_OPTIONS: { value: LenderType; label: string }[] = [
  { value: "BANK", label: "Bank" },
  { value: "CREDIT_UNION", label: "Credit Union" },
  { value: "CAPTIVE", label: "Captive" },
  { value: "OTHER", label: "Other" },
];

export const LENDER_EXTERNAL_SYSTEM_OPTIONS: {
  value: LenderExternalSystem;
  label: string;
}[] = [
  { value: "NONE", label: "None" },
  { value: "ROUTEONE", label: "RouteOne" },
  { value: "DEALERTRACK", label: "DealerTrack" },
  { value: "CUDL", label: "CUDL" },
  { value: "OTHER", label: "Other" },
];
