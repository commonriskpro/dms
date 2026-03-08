import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import {
  callDealerApplicationGet,
  callDealerApplicationPatch,
} from "@/lib/call-dealer-internal";

export const dynamic = "force-dynamic";

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
    const { id } = await ctx.params;
    const result = await callDealerApplicationGet(id, {});
    if (!result.ok) {
      return jsonResponse(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.status >= 400 ? result.error.status : 502
      );
    }
    return jsonResponse(result.data);
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
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      status?: string;
      dealershipId?: string | null;
      platformApplicationId?: string | null;
      platformDealershipId?: string | null;
      reviewerUserId?: string | null;
      reviewNotes?: string | null;
      rejectionReason?: string | null;
    };
    const result = await callDealerApplicationPatch(
      id,
      {
        ...body,
        reviewerUserId: body.reviewerUserId ?? user.userId,
      },
      {}
    );
    if (!result.ok) {
      return jsonResponse(
        { error: { code: result.error.code, message: result.error.message } },
        result.error.status >= 400 ? result.error.status : 502
      );
    }
    return jsonResponse(result.data);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
