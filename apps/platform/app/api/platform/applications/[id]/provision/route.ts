import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import {
  provisionDealershipFromApplication,
  ApplicationNotFoundError,
  InvalidStateError,
  DealerProvisionError,
} from "@/lib/application-onboarding";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);
    const { id: applicationId } = await ctx.params;
    const result = await provisionDealershipFromApplication(applicationId, user.userId);
    return jsonResponse(result);
  } catch (e) {
    if (e instanceof ApplicationNotFoundError) {
      return errorResponse("NOT_FOUND", "Application not found", 404);
    }
    if (e instanceof InvalidStateError) {
      return errorResponse("INVALID_STATE", e.message, 422);
    }
    if (e instanceof DealerProvisionError) {
      return errorResponse(
        "DEALER_PROVISION_FAILED",
        e.message,
        e.status >= 400 ? e.status : 502
      );
    }
    return handlePlatformApiError(e);
  }
}
