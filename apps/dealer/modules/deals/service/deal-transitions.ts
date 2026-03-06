import type { DealStatus } from "@prisma/client";

/**
 * Allowed deal status transitions. CONTRACTED can only go to CANCELED.
 * CANCELED is terminal (no transitions).
 */
export const ALLOWED_TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: ["STRUCTURED", "CANCELED"],
  STRUCTURED: ["APPROVED", "CANCELED"],
  APPROVED: ["CONTRACTED", "CANCELED"],
  CONTRACTED: ["CANCELED"],
  CANCELED: [],
};

export function isAllowedTransition(from: DealStatus, to: DealStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
