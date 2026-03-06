import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { getOrCreateRequestId } from "@/lib/request-id";
import { callDealerRateLimits } from "@/lib/call-dealer-internal";
import { platformRateLimitStatsQuerySchema } from "@dms/contracts";

export const dynamic = "force-dynamic";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * GET /api/platform/monitoring/rate-limits
 * Proxy to dealer internal rate limit stats. RBAC: PLATFORM_OWNER, PLATFORM_COMPLIANCE, PLATFORM_SUPPORT.
 */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));

  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const parsed = platformRateLimitStatsQuerySchema.safeParse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      routeKey: searchParams.get("routeKey") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (!parsed.success) {
      return jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parsed.error.flatten(),
          },
        },
        422
      );
    }

    const query = parsed.data;
    const result = await callDealerRateLimits(
      {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        routeKey: query.routeKey,
        limit: query.limit,
        offset: query.offset,
      },
      { requestId }
    );

    if (!result.ok) {
      const status = result.error.status >= 500 ? 502 : result.error.status;
      return jsonResponse(
        {
          error: {
            code: "UPSTREAM_ERROR",
            message: "Dealer rate-limit monitoring unavailable",
          },
        },
        status
      );
    }

    return jsonResponse({
      items: result.data.items,
      limit: result.data.limit,
      offset: result.data.offset,
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
