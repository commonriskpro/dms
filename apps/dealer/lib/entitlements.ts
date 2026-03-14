import { prisma } from "@/lib/db";
import { fetchEntitlementsForDealership } from "@/lib/call-platform-internal";
import { ApiError } from "@/lib/auth";
export { canAccessModule, canShowModuleInNav } from "@/lib/entitlements-client";

/**
 * Count active memberships for a dealership (disabledAt null).
 * Used for seat-cap enforcement at activation time.
 */
export async function countActiveMemberships(dealershipId: string): Promise<number> {
  return prisma.membership.count({
    where: { dealershipId, disabledAt: null },
  });
}

/**
 * Throws SEAT_LIMIT_REACHED if adding one more active membership would exceed the dealership's seat cap.
 * Call before creating a membership (invite accept or re-enable).
 * If entitlements cannot be fetched (no platform, no mapping), allows activation (fail open).
 */
export async function assertSeatAvailableForActivation(dealershipId: string): Promise<void> {
  const entitlements = await fetchEntitlementsForDealership(dealershipId);
  if (!entitlements || entitlements.maxSeats == null) return;

  const current = await countActiveMemberships(dealershipId);
  if (current >= entitlements.maxSeats) {
    throw new ApiError(
      "SEAT_LIMIT_REACHED",
      "Seat limit reached for this dealership. Upgrade your plan or disable another user to add more."
    );
  }
}

/**
 * Throws FORBIDDEN (403) "Module not included in your plan" when the dealership's subscription
 * does not include the given module. Use on high-value module-scoped API routes (e.g. reports export).
 * If entitlements cannot be fetched (no platform, no mapping), does not throw (fail open).
 */
export async function requireModuleEntitlement(dealershipId: string, moduleKey: string): Promise<void> {
  const entitlements = await fetchEntitlementsForDealership(dealershipId);
  if (!entitlements) return;
  if (!Array.isArray(entitlements.modules) || entitlements.modules.includes(moduleKey)) return;
  throw new ApiError("FORBIDDEN", "Module not included in your plan");
}
