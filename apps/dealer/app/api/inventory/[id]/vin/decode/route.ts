import { NextRequest } from "next/server";
import { z } from "zod";
import * as vinDecodeService from "@/modules/inventory/service/vin-decode";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  checkRateLimitByDealership,
  incrementRateLimitByDealership,
} from "@/lib/api/rate-limit";
import { idParamSchema, vinDecodeTriggerBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    if (!checkRateLimitByDealership(ctx.dealershipId, "vin_decode")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many VIN decode requests" } },
        { status: 429 }
      );
    }
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request).catch(() => ({}));
    vinDecodeTriggerBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const result = await vinDecodeService.decodeVin(
      ctx.dealershipId,
      id,
      ctx.userId,
      meta
    );
    incrementRateLimitByDealership(ctx.dealershipId, "vin_decode");
    return jsonResponse(
      { data: { decodeId: result.decodeId, status: result.status } },
      202
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
