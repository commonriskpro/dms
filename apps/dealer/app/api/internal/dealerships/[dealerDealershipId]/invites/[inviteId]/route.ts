import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import * as platformInviteService from "@/modules/platform-admin/service/invite";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";
import { readSanitizedJson } from "@/lib/api/handler";

const REQUEST_ID_HEADER = "x-request-id";
const paramsSchema = z.object({
  dealerDealershipId: z.string().uuid(),
  inviteId: z.string().uuid(),
});
const bodySchema = z.object({
  cancel: z.literal(true).optional(),
  platformActorId: z.string().uuid(),
});

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealerDealershipId: string; inviteId: string }> }
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

  const paramsResult = paramsSchema.safeParse(await params);
  if (!paramsResult.success) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "Invalid path params (UUIDs required)", 422),
      requestId
    );
  }
  const { dealerDealershipId, inviteId } = paramsResult.data;

  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return addRequestIdToResponse(err("VALIDATION_ERROR", "Invalid JSON body", 422), requestId);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "Body must include cancel: true and platformActorId (UUID)", 422),
      requestId
    );
  }

  if (parsed.data.cancel === true) {
    try {
      await platformInviteService.cancelInviteFromPlatform(
        dealerDealershipId,
        inviteId,
        parsed.data.platformActorId
      );
      return addRequestIdToResponse(new Response(null, { status: 204 }), requestId);
    } catch (e) {
      const { ApiError } = await import("@/lib/auth");
      if (e instanceof ApiError) {
        if (e.code === "NOT_FOUND")
          return addRequestIdToResponse(err("NOT_FOUND", e.message, 404), requestId);
        if (e.code === "CONFLICT")
          return addRequestIdToResponse(err("CONFLICT", e.message, 409), requestId);
      }
      throw e;
    }
  }

  return addRequestIdToResponse(err("VALIDATION_ERROR", "Unsupported action", 422), requestId);
}
