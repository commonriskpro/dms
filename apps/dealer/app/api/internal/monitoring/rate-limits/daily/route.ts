import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { listRateLimitDailyStats } from "@/lib/rate-limit-stats";
import { dealerRateLimitsDailyQuerySchema } from "@dms/contracts";
import { addRequestIdToResponse, getOrCreateRequestId } from "@/lib/request-id";

const REQUEST_ID_HEADER = "x-request-id";

function errorResponse(code: string, message: string, status: number, details?: unknown): Response {
  return Response.json(
    details != null ? { error: { code, message, details } } : { error: { code, message } },
    { status }
  );
}

/**
 * GET /api/internal/monitoring/rate-limits/daily
 * Service-to-service JWT required. Returns daily aggregate rows only (no raw IP hashes).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));

  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return addRequestIdToResponse(rateLimitRes, requestId);

  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof InternalApiError) {
      return addRequestIdToResponse(errorResponse(e.code, e.message, e.status), requestId);
    }
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const parsed = dealerRateLimitsDailyQuerySchema.safeParse({
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return addRequestIdToResponse(
      errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten()),
      requestId
    );
  }

  const query = parsed.data;
  const { items, total } = await listRateLimitDailyStats(query);
  return addRequestIdToResponse(
    Response.json({
      items,
      total,
      limit: query.limit,
      offset: query.offset,
    }),
    requestId
  );
}
