import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { callDealerApplicationsList } from "@/lib/call-dealer-internal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, [
      "PLATFORM_OWNER",
      "PLATFORM_COMPLIANCE",
      "PLATFORM_SUPPORT",
    ]);
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const status = searchParams.get("status") ?? undefined;
    const source = searchParams.get("source") ?? undefined;
    const result = await callDealerApplicationsList(
      {
        limit: limit ? parseInt(limit, 10) : 25,
        offset: offset ? parseInt(offset, 10) : 0,
        status,
        source,
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
