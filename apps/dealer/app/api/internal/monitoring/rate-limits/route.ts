import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { listRateLimitSnapshots } from "@/lib/rate-limit-stats";
import { dealerRateLimitsQuerySchema } from "@dms/contracts";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * GET /api/internal/monitoring/rate-limits
 * Service-to-service JWT required. Returns rate limit events aggregated by routeKey and 1-minute bucket.
 */
export async function GET(request: NextRequest) {
  const handlerStartedAt = Date.now();
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  const authHeader = request.headers.get("authorization");
  try {
    await verifyInternalApiJwt(authHeader);
  } catch (e) {
    if (e instanceof InternalApiError) {
      return errorResponse(e.code, e.message, e.status);
    }
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const parsed = dealerRateLimitsQuerySchema.safeParse({
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    routeKey: searchParams.get("routeKey") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 }
    );
  }

  const query = parsed.data;
  const serviceStartedAt = Date.now();
  const items = await listRateLimitSnapshots({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    routeKey: query.routeKey,
    limit: query.limit,
    offset: query.offset,
  });
  const serviceMs = Date.now() - serviceStartedAt;
  const handlerMs = Date.now() - handlerStartedAt;

  return Response.json(
    {
      items,
      limit: query.limit,
      offset: query.offset,
    },
    {
      headers: {
        "x-bridge-handler-ms": String(handlerMs),
        "x-bridge-service-ms": String(serviceMs),
        "x-bridge-db-ms": String(serviceMs),
      },
    }
  );
}
