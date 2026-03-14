import { NextRequest } from "next/server";
import { z } from "zod";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import {
  DealerApplicationNotFoundError,
  getPlatformDealerApplication,
  updatePlatformDealerApplicationReview,
} from "@/lib/dealer-applications";
import { dealerApplicationPatchRequestSchema } from "@dms/contracts";

export const dynamic = "force-dynamic";
const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, [
      "PLATFORM_OWNER",
      "PLATFORM_COMPLIANCE",
      "PLATFORM_SUPPORT",
    ]);
    const { id } = paramsSchema.parse(await ctx.params);
    const result = await getPlatformDealerApplication(id);
    if (!result) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Dealer application not found" } }, 404);
    }
    return jsonResponse(result);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE"]);
    const { id } = paramsSchema.parse(await ctx.params);
    const body = dealerApplicationPatchRequestSchema.parse(await request.json());
    const result = await updatePlatformDealerApplicationReview(
      id,
      {
        ...body,
        reviewerUserId: body.reviewerUserId ?? user.userId,
      },
      user.userId
    );
    return jsonResponse(result);
  } catch (e) {
    if (e instanceof DealerApplicationNotFoundError) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Dealer application not found" } }, 404);
    }
    return handlePlatformApiError(e);
  }
}
