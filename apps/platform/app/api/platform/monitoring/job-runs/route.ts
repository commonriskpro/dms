import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { getOrCreateRequestId } from "@/lib/request-id";
import { prisma } from "@/lib/db";
import { platformJobRunsQuerySchema } from "@dms/contracts";
import { callDealerJobRuns } from "@/lib/call-dealer-internal";

export const dynamic = "force-dynamic";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * GET /api/platform/monitoring/job-runs
 * Query: platformDealershipId OR dealershipId (required), dateFrom, dateTo, limit, offset.
 * RBAC: PLATFORM_OWNER / PLATFORM_COMPLIANCE / PLATFORM_SUPPORT (403 before lookup).
 * Resolves platformDealershipId to dealer dealershipId via DealershipMapping, then proxies to dealer internal job-runs.
 */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));

  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const { searchParams } = new URL(request.url);
    const parsed = platformJobRunsQuerySchema.safeParse({
      platformDealershipId: searchParams.get("platformDealershipId") ?? undefined,
      dealershipId: searchParams.get("dealershipId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const { platformDealershipId, dealershipId, dateFrom, dateTo, limit, offset } = parsed.data;
    let dealerDealershipId: string;

    if (platformDealershipId != null) {
      const mapping = await prisma.dealershipMapping.findUnique({
        where: { platformDealershipId },
        select: { dealerDealershipId: true },
      });
      if (!mapping) {
        return errorResponse("NOT_FOUND", "Dealership mapping not found for platformDealershipId", 404);
      }
      dealerDealershipId = mapping.dealerDealershipId;
    } else {
      dealerDealershipId = dealershipId!;
    }

    const result = await callDealerJobRuns(
      dealerDealershipId,
      { dateFrom, dateTo, limit, offset },
      { requestId }
    );

    if (!result.ok) {
      const status = result.error.status >= 500 ? 502 : result.error.status;
      return jsonResponse({ data: [], total: 0 }, status);
    }

    return jsonResponse({
      data: result.data.data,
      total: result.data.total,
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
