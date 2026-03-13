import { NextRequest } from "next/server";
import { z } from "zod";
import * as floorplanService from "@/modules/inventory/service/floorplan";
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
import { idParamSchema, curtailmentBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.write");
    if (!checkRateLimitByDealership(ctx.dealershipId, "floorplan_curtailment")) {
      return Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many curtailment requests",
          },
        },
        { status: 429 }
      );
    }
    const { id } = idParamSchema.parse(await context.params);
    const body = curtailmentBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const curtailment = await floorplanService.addCurtailment(
      ctx.dealershipId,
      id,
      body.amountCents,
      new Date(body.paidAt),
      ctx.userId,
      meta
    );
    incrementRateLimitByDealership(ctx.dealershipId, "floorplan_curtailment");
    return jsonResponse(
      {
        data: {
          id: curtailment.id,
          amountCents: curtailment.amountCents,
          paidAt: curtailment.paidAt,
        },
      },
      201
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
