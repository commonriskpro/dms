import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { getEntitlementsForDealerDealershipId } from "@/lib/service/entitlements";
import { entitlementsResponseSchema } from "@dms/contracts";
import { errorResponse, jsonResponse } from "@/lib/api-handler";
import { z } from "zod";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ dealerDealershipId: z.string().uuid() });

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ dealerDealershipId: string }> }
) {
  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof InternalApiError) {
      return errorResponse(e.code, e.message, e.status);
    }
    throw e;
  }

  const paramsResult = paramsSchema.safeParse(await ctx.params);
  if (!paramsResult.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid dealerDealershipId", 422);
  }

  const { dealerDealershipId } = paramsResult.data;
  const raw = await getEntitlementsForDealerDealershipId(dealerDealershipId);
  if (!raw) {
    return errorResponse("NOT_FOUND", "Dealership not found or not provisioned", 404);
  }

  const payload = entitlementsResponseSchema.parse(raw);
  return jsonResponse(payload, 200);
}
