import { NextRequest } from "next/server";
import { getAuthContext, handleApiError, jsonResponse, guardAnyPermission } from "@/lib/api/handler";
import { countActiveMemberships } from "@/lib/entitlements";
import { fetchEntitlementsForDealership } from "@/lib/call-platform-internal";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/seat-usage
 * Returns used and max seats for the current dealership (for invite UI).
 * Requires admin.users.read or admin.memberships.read.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["admin.users.read", "admin.memberships.read"]);
    const used = await countActiveMemberships(ctx.dealershipId);
    const entitlements = await fetchEntitlementsForDealership(ctx.dealershipId);
    const maxSeats = entitlements?.maxSeats ?? null;
    return jsonResponse({
      usedSeats: used,
      maxSeats: maxSeats ?? undefined,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
