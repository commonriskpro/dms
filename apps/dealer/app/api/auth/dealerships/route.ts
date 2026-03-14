import { requireUser } from "@/lib/auth";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import * as sessionService from "@/modules/core-platform/service/session";

/**
 * GET /api/auth/dealerships — List dealerships the current user is a member of.
 * Use when the user has no active dealership (e.g. on Get Started after platform invite).
 * Does not require an active dealership.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const dealerships = (await sessionService.listUserDealerships(user.userId)).map((dealership) => ({
      id: dealership.dealershipId,
      name: dealership.dealershipName,
    }));
    return jsonResponse({ data: { dealerships } });
  } catch (e) {
    return handleApiError(e);
  }
}
