import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { provisionDealership } from "@/modules/provisioning/service/provision";
import { provisionDealershipRequestSchema } from "@dms/contracts";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { captureApiException } from "@/lib/monitoring/sentry";
import { readSanitizedJson } from "@/lib/api/handler";

const REQUEST_ID_HEADER = "x-request-id";

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

const ROUTE = "/api/internal/provision/dealership";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));

  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return addRequestIdToResponse(rateLimitRes, requestId);
  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof InternalApiError) {
      logger.warn("Internal API auth failure", {
        requestId,
        route: ROUTE,
        method: "POST",
        status: e.status,
        errorCode: e.code,
      });
      captureApiException(e, {
        app: "dealer",
        requestId,
        route: ROUTE,
        method: "POST",
      });
      return addRequestIdToResponse(err(e.code, e.message, e.status), requestId);
    }
    throw e;
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255)
    return addRequestIdToResponse(err("VALIDATION_ERROR", "Idempotency-Key header required (1-255 chars)", 422), requestId);
  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return addRequestIdToResponse(err("VALIDATION_ERROR", "Invalid JSON body", 422), requestId);
  }
  const parsed = provisionDealershipRequestSchema.safeParse(body);
  if (!parsed.success) {
    return addRequestIdToResponse(
      Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten() } },
        { status: 422 }
      ),
      requestId
    );
  }
  const { platformDealershipId, legalName, displayName, planKey, limits } = parsed.data;
  try {
    const result = await provisionDealership(
      platformDealershipId,
      legalName,
      displayName,
      planKey,
      (limits as Record<string, unknown>) ?? {},
      idempotencyKey
    );
    return addRequestIdToResponse(
      Response.json(
        { dealerDealershipId: result.dealerDealershipId, provisionedAt: result.provisionedAt.toISOString() },
        { status: 201 }
      ),
      requestId
    );
  } catch (e) {
    if (e instanceof Error && e.message === "CONFLICT_PLATFORM_DEALERSHIP_ID")
      return addRequestIdToResponse(err("CONFLICT", "Duplicate platformDealershipId mapping", 409), requestId);
    throw e;
  }
}
