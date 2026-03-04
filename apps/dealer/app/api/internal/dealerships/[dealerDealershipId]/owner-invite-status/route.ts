import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import { jsonResponse } from "@/lib/api/handler";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";

const REQUEST_ID_HEADER = "x-request-id";
const MAX_EMAIL_LENGTH = 320;
const paramsSchema = z.object({ dealerDealershipId: z.string().uuid() });

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

export async function GET(
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

  const paramsResult = paramsSchema.safeParse(await params);
  if (!paramsResult.success) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "Invalid dealerDealershipId (must be UUID)", 422),
      requestId
    );
  }
  const { dealerDealershipId } = paramsResult.data;
  const email = request.nextUrl.searchParams.get("email");
  if (!email || email.length > MAX_EMAIL_LENGTH) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "dealershipId and email (max 320 chars) required", 422),
      requestId
    );
  }

  const invite = await inviteDb.getLatestOwnerInviteByDealershipAndEmail(
    dealerDealershipId,
    email
  );
  if (!invite) {
    return addRequestIdToResponse(
      jsonResponse({
        status: "PENDING" as const,
        expiresAt: null,
        acceptedAt: null,
      }),
      requestId
    );
  }

  return addRequestIdToResponse(
    jsonResponse({
      status: invite.status,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    }),
    requestId
  );
}
