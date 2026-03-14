import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { setActiveDealershipCookie } from "@/lib/tenant";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import * as bootstrapService from "@/modules/core-platform/service/bootstrap";

/**
 * Links the current authenticated user as Owner of the first (demo) dealership.
 * Only allowed when that dealership has no members (initial bootstrap) or ALLOW_BOOTSTRAP_LINK=1.
 * Creates Profile if missing (using Supabase user email).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const result = await bootstrapService.bootstrapLinkOwnerToDemoDealership({
      userId: user.userId,
      email: user.email,
      allowBootstrap: process.env.ALLOW_BOOTSTRAP_LINK === "1",
    });
    await setActiveDealershipCookie(result.dealershipId);
    return jsonResponse(result);
  } catch (e) {
    return handleApiError(e);
  }
}
