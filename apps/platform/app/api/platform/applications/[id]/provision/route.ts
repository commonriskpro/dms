import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse, errorResponse } from "@/lib/api-handler";
import { checkPlatformRateLimit, getPlatformClientIdentifier } from "@/lib/rate-limit";
import {
  provisionDealershipFromApplication,
  ApplicationNotFoundError,
  InvalidStateError,
  DealerProvisionError,
} from "@/lib/application-onboarding";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER"]);

    const clientId = getPlatformClientIdentifier(request);
    if (!checkPlatformRateLimit(clientId, "provision")) {
      return errorResponse("RATE_LIMITED", "Too many requests", 429);
    }

    const paramsResult = paramsSchema.safeParse(await ctx.params);
    if (!paramsResult.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid application id", 422, paramsResult.error.flatten());
    }
    const applicationId = paramsResult.data.id;
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
