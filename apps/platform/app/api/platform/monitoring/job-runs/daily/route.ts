import { NextRequest } from "next/server";
import {
  platformJobRunsDailyQuerySchema,
  platformJobRunDailyRowSchema,
} from "@dms/contracts";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { REQUEST_ID_HEADER, addRequestIdToResponse, getOrCreateRequestId } from "@/lib/request-id";
import { callDealerJobRunsDaily } from "@/lib/call-dealer-internal";

export const dynamic = "force-dynamic";

/**
 * GET /api/platform/monitoring/job-runs/daily
 * Read-only proxy for daily dealer aggregated job-run stats.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const parsed = platformJobRunsDailyQuerySchema.safeParse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      dealershipId: searchParams.get("dealershipId") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });
    if (!parsed.success) {
      return addRequestIdToResponse(
        errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten()),
        requestId
      );
    }

    const result = await callDealerJobRunsDaily(parsed.data, { requestId });
    if (!result.ok) {
      const status = result.error.status >= 500 ? 502 : result.error.status;
      return addRequestIdToResponse(
        jsonResponse(
          {
            error: {
              code: "UPSTREAM_ERROR",
              message: "Dealer daily job-run stats unavailable",
              details: { requestId, upstreamStatus: result.error.status },
            },
          },
          status
        ),
        requestId
      );
    }

    const items = result.data.items.map((row) => platformJobRunDailyRowSchema.parse(row));
    return addRequestIdToResponse(
      jsonResponse({
        items,
        total: result.data.total,
        limit: result.data.limit,
        offset: result.data.offset,
      }),
      requestId
    );
  } catch (e) {
    return addRequestIdToResponse(handlePlatformApiError(e), requestId);
  }
}
