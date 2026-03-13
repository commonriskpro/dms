import { NextRequest } from "next/server";
import { z } from "zod";
import * as floorplanLoansService from "@/modules/inventory/service/floorplan-loans";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { floorplanLoanIdParamSchema, floorplanLoanUpdateBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

function rateLimitKey(ctx: { dealershipId: string; userId: string }) {
  return `inventory:${ctx.dealershipId}:${ctx.userId}`;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ floorplanLoanId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const rlKey = rateLimitKey(ctx);
    if (!checkRateLimit(rlKey, "inventory_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const { floorplanLoanId } = floorplanLoanIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = floorplanLoanUpdateBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await floorplanLoansService.markFloorplanStatus(
      ctx.dealershipId,
      floorplanLoanId,
      data.status,
      ctx.userId,
      meta
    );
    incrementRateLimit(rlKey, "inventory_mutation");
    return jsonResponse({
      data: {
        id: updated.id,
        vehicleId: updated.vehicleId,
        lender: updated.lender,
        principalCents: updated.principalCents,
        interestBps: updated.interestBps,
        startDate: updated.startDate,
        curtailmentDate: updated.curtailmentDate,
        status: updated.status,
        notes: updated.notes,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
