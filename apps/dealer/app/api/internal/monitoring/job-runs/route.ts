import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { dealerJobRunsQuerySchema, dealerJobRunEventSchema } from "@dms/contracts";
import * as dealerJobRunDb from "@/modules/crm-pipeline-automation/db/dealer-job-run";

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return Response.json(
    details != null ? { error: { code, message, details } } : { error: { code, message } },
    { status }
  );
}

/**
 * GET /api/internal/monitoring/job-runs
 * Query: dealershipId, dateFrom, dateTo, limit, offset.
 * JWT required. Returns paginated list of job run events (dealerJobRunEventSchema shape).
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
  const parsed = dealerJobRunsQuerySchema.safeParse({
    dealershipId: searchParams.get("dealershipId") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    offset: searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
  }

  const { dealershipId, dateFrom, dateTo, limit, offset } = parsed.data;
  const dateFromDate = new Date(dateFrom);
  const dateToDate = new Date(dateTo);

  const serviceStartedAt = Date.now();
  const { data, total } = await dealerJobRunDb.listDealerJobRuns(dealershipId, {
    dealershipId,
    dateFrom: dateFromDate,
    dateTo: dateToDate,
    limit,
    offset,
  });
  const serviceMs = Date.now() - serviceStartedAt;

  const events = data.map((r) =>
    dealerJobRunEventSchema.parse({
      runId: r.id,
      dealershipId: r.dealershipId,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt.toISOString(),
      processed: r.processed,
      failed: r.failed,
      deadLetter: r.deadLetter,
      skippedReason: r.skippedReason,
      durationMs: r.durationMs,
    })
  );

  const handlerMs = Date.now() - handlerStartedAt;
  return Response.json(
    { data: events, total },
    {
      headers: {
        "x-bridge-handler-ms": String(handlerMs),
        "x-bridge-service-ms": String(serviceMs),
        "x-bridge-db-ms": String(serviceMs),
      },
    }
  );
}
