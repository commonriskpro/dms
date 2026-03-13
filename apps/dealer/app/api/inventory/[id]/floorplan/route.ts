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
import { idParamSchema, floorplanUpsertBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.read");
    const { id } = idParamSchema.parse(await context.params);
    const floorplan = await floorplanService.getFloorplan(ctx.dealershipId, id);
    if (!floorplan) {
      return jsonResponse({ data: null });
    }
    return jsonResponse({
      data: {
        id: floorplan.id,
        vehicleId: floorplan.vehicleId,
        lenderId: floorplan.lenderId,
        lenderName: floorplan.lender?.name ?? undefined,
        principalCents: floorplan.principalCents,
        aprBps: floorplan.aprBps,
        startDate: floorplan.startDate,
        nextCurtailmentDueDate: floorplan.nextCurtailmentDueDate,
        curtailments: floorplan.curtailments.map((c) => ({
          id: c.id,
          amountCents: c.amountCents,
          paidAt: c.paidAt,
        })),
        payoffQuoteCents: floorplan.payoffQuoteCents,
        payoffQuoteExpiresAt: floorplan.payoffQuoteExpiresAt,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = floorplanUpsertBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const floorplan = await floorplanService.upsertFloorplan(
      ctx.dealershipId,
      id,
      {
        lenderId: body.lenderId,
        principalCents: body.principalCents,
        aprBps: body.aprBps,
        startDate: new Date(body.startDate),
        nextCurtailmentDueDate:
          body.nextCurtailmentDueDate != null
            ? body.nextCurtailmentDueDate === null
              ? null
              : new Date(body.nextCurtailmentDueDate)
            : undefined,
      },
      ctx.userId,
      meta
    );
    return jsonResponse({
      data: {
        id: floorplan.id,
        vehicleId: floorplan.vehicleId,
        lenderId: floorplan.lenderId,
        lenderName: floorplan.lender?.name,
        principalCents: floorplan.principalCents,
        aprBps: floorplan.aprBps,
        startDate: floorplan.startDate,
        nextCurtailmentDueDate: floorplan.nextCurtailmentDueDate,
        curtailments: floorplan.curtailments.map((c) => ({
          id: c.id,
          amountCents: c.amountCents,
          paidAt: c.paidAt,
        })),
        payoffQuoteCents: floorplan.payoffQuoteCents,
        payoffQuoteExpiresAt: floorplan.payoffQuoteExpiresAt,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
