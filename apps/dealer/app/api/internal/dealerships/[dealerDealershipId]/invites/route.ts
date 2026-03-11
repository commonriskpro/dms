import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import { maskInviteEmail } from "@/modules/platform-admin/service/invite";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";
import { listPayload } from "@/lib/api/list-response";

const REQUEST_ID_HEADER = "x-request-id";
const paramsSchema = z.object({ dealerDealershipId: z.string().uuid() });
const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"]).optional(),
});

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

  const { searchParams } = new URL(request.url);
  const queryResult = querySchema.safeParse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
    status: searchParams.get("status") ?? undefined,
  });
  if (!queryResult.success) {
    return addRequestIdToResponse(
      err("VALIDATION_ERROR", "Invalid query params", 422),
      requestId
    );
  }
  const { limit, offset, status } = queryResult.data;

  const { data, total } = await inviteDb.listInvitesByDealership(
    dealerDealershipId,
    { status },
    { limit, offset }
  );

  const body = listPayload(
    data.map((i) => ({
      id: i.id,
      emailMasked: maskInviteEmail(i.email),
      roleName: i.role.name,
      status: i.status,
      expiresAt: i.expiresAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      acceptedAt: i.acceptedAt?.toISOString() ?? null,
    })),
    total,
    limit,
    offset
  );
  return addRequestIdToResponse(Response.json(body), requestId);
}
