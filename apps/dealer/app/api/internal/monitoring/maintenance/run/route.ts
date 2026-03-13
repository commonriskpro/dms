import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { addRequestIdToResponse, getOrCreateRequestId } from "@/lib/request-id";
import { dealerMonitoringMaintenanceRequestSchema } from "@dms/contracts";
import { getTelemetryRetentionConfig } from "@/lib/env";
import { aggregateRateLimitDaily, purgeOldRateLimitEvents } from "@/lib/rate-limit-stats";
import { aggregateJobRunsDaily, purgeOldJobRuns } from "@/lib/job-run-stats";
import { readSanitizedJson } from "@/lib/api/handler";

const REQUEST_ID_HEADER = "x-request-id";

function errorResponse(code: string, message: string, status: number, details?: unknown): Response {
  return Response.json(
    details != null ? { error: { code, message, details } } : { error: { code, message } },
    { status }
  );
}

/**
 * POST /api/internal/monitoring/maintenance/run
 * Service-to-service JWT required. Runs purge and/or aggregate jobs with sanitized response.
 */
export async function POST(request: NextRequest): Promise<Response> {
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

  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return addRequestIdToResponse(errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422), requestId);
  }

  const parsed = dealerMonitoringMaintenanceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return addRequestIdToResponse(
      errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten()),
      requestId
    );
  }

  const payload: {
    ok: true;
    requestId: string;
    purged?: { rateLimitEventsDeleted: number; jobRunsDeleted: number };
    aggregated?: { day: string; rateLimitRowsUpserted: number; jobRunRowsUpserted: number };
  } = {
    ok: true,
    requestId,
  };

  if (parsed.data.kind === "purge" || parsed.data.kind === "all") {
    const retention = getTelemetryRetentionConfig();
    const [rateLimitResult, jobRunsResult] = await Promise.all([
      purgeOldRateLimitEvents({ olderThanDays: retention.rateLimitDays }),
      purgeOldJobRuns({ olderThanDays: retention.jobRunsDays }),
    ]);
    payload.purged = {
      rateLimitEventsDeleted: rateLimitResult.deletedCount,
      jobRunsDeleted: jobRunsResult.deletedCount,
    };
  }

  if (parsed.data.kind === "aggregate" || parsed.data.kind === "all") {
    const [rateLimitDaily, jobRunsDaily] = await Promise.all([
      aggregateRateLimitDaily(parsed.data.date),
      aggregateJobRunsDaily(parsed.data.date),
    ]);
    payload.aggregated = {
      day: rateLimitDaily.day,
      rateLimitRowsUpserted: rateLimitDaily.upsertedCount,
      jobRunRowsUpserted: jobRunsDaily.upsertedCount,
    };
  }

  return addRequestIdToResponse(Response.json(payload), requestId);
}
