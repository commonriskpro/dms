import { NextRequest } from "next/server";
import { z } from "zod";
import * as vinDecodeCacheService from "@/modules/inventory/service/vin-decode-cache";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  checkRateLimitByDealership,
  incrementRateLimitByDealership,
} from "@/lib/api/rate-limit";
import { vinDecodeBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { ApiError } from "@/lib/auth";
import { errorResponse } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    if (!checkRateLimitByDealership(ctx.dealershipId, "vin_decode")) {
      return Response.json(
        errorResponse("RATE_LIMITED", "Too many VIN decode requests"),
        { status: 429 }
      );
    }
    const body = await readSanitizedJson(request);
    const { vin } = vinDecodeBodySchema.parse(body);
    const result = await vinDecodeCacheService.decodeVin(ctx.dealershipId, vin);
    incrementRateLimitByDealership(ctx.dealershipId, "vin_decode");
    return jsonResponse({
      data: {
        vin: result.vin,
        decoded: result.decoded,
        vehicle: result.vehicle,
        source: result.source,
        cached: result.cached,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    if (e instanceof ApiError && e.code === "INVALID_VIN") {
      return Response.json(
        { error: { code: e.code, message: e.message, details: e.details } },
        { status: 400 }
      );
    }
    if (e instanceof Error && e.message.startsWith("NHTSA API error:")) {
      return Response.json(
        {
          error: {
            code: "INTERNAL",
            message: "VIN decode service unavailable",
          },
        },
        { status: 502 }
      );
    }
    if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
      return Response.json(
        {
          error: {
            code: "INTERNAL",
            message: "VIN decode service unavailable",
          },
        },
        { status: 502 }
      );
    }
    return handleApiError(e);
  }
}
