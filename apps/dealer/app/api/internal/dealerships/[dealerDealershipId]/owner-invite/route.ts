import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { readSanitizedJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import * as inviteService from "@/modules/invite-bridge/service/invite";
import {
  dealerOwnerInviteRequestSchema,
  type DealerOwnerInviteRequest,
} from "@dms/contracts";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";

const REQUEST_ID_HEADER = "x-request-id";
const paramsSchema = z.object({ dealerDealershipId: z.string().uuid() });

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

function apiErrorStatus(code: string): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 422;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
      return 429;
    default:
      return 500;
  }
}

function getDealerAppBaseUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealerDealershipId: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return addRequestIdToResponse(rateLimitRes, requestId);

  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof InternalApiError)
      return addRequestIdToResponse(err(e.code, e.message, e.status), requestId);
    throw e;
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 255) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "Idempotency-Key header required (1-255 chars)", 422),
      requestId
    );
  }

  const paramsResult = paramsSchema.safeParse(await params);
  if (!paramsResult.success) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "Invalid dealerDealershipId (must be UUID)", 422),
      requestId
    );
  }
  const { dealerDealershipId } = paramsResult.data;

  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return addRequestIdToResponse(err("VALIDATION_ERROR", "Invalid JSON body", 422), requestId);
  }

  const parsed = dealerOwnerInviteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return addRequestIdToResponse(
      Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parsed.error.flatten(),
          },
        },
        { status: 422 }
      ),
      requestId
    );
  }

  const { email, platformDealershipId, platformActorId, dealerApplicationId } =
    parsed.data as DealerOwnerInviteRequest;
  try {
    const result = await inviteService.createOwnerInviteFromPlatform({
      dealershipId: dealerDealershipId,
      idempotencyKey,
      email,
      platformDealershipId,
      platformActorId,
      dealerApplicationId: dealerApplicationId ?? null,
      baseUrl: getDealerAppBaseUrl(request),
    });
    return addRequestIdToResponse(Response.json(result.data, { status: result.status }), requestId);
  } catch (error) {
    if (error instanceof ApiError) {
      return addRequestIdToResponse(
        err(error.code, error.message, apiErrorStatus(error.code)),
        requestId
      );
    }
    throw error;
  }
}
