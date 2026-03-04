import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { vinDecodeBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const body = await request.json();
    const { vin } = vinDecodeBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const result = await inventoryService.decodeVin(
      ctx.dealershipId,
      ctx.userId,
      vin,
      meta
    );
    return jsonResponse({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    if (e instanceof Error && e.message.startsWith("NHTSA API error:")) {
      return Response.json(
        {
          error: {
            code: "INTERNAL",
            message: "VIN decode service unavailable",
            details: { cause: e.message },
          },
        },
        { status: 502 }
      );
    }
    return handleApiError(e);
  }
}
