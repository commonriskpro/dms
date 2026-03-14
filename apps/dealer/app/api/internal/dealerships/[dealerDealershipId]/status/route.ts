import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { setDealershipStatusRequestSchema } from "@dms/contracts";
import { readSanitizedJson } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import * as dealershipService from "@/modules/admin-core/service/dealership";

function errorResponse(code: string, message: string, status: number) {
  return Response.json(
    { error: { code, message } },
    { status }
  );
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ dealerDealershipId: string }> }
) {
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

  const { dealerDealershipId } = await ctx.params;
  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422);
  }
  const parsed = setDealershipStatusRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.flatten() } },
      { status: 422 }
    );
  }
  const { status, reason, platformActorId } = parsed.data;

  try {
    await dealershipService.setDealershipLifecycleStatusFromPlatform({
      dealershipId: dealerDealershipId,
      status,
      reason,
      platformActorId,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.code, error.message, error.code === "NOT_FOUND" ? 404 : 400);
    }
    throw error;
  }

  return Response.json({ ok: true as const }, { status: 200 });
}
