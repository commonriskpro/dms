import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealService from "@/modules/deals/service/deal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { dealIdParamSchema, updateDealBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDeal } from "../serialize";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const { id } = dealIdParamSchema.parse(await context.params);
    const deal = await dealService.getDeal(ctx.dealershipId, id);
    return jsonResponse({ data: serializeDeal(deal) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = await request.json();
    const data = updateDealBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await dealService.updateDeal(ctx.dealershipId, ctx.userId, id, {
      salePriceCents: data.salePriceCents,
      taxRateBps: data.taxRateBps,
      docFeeCents: data.docFeeCents,
      downPaymentCents: data.downPaymentCents,
      notes: data.notes,
    }, meta);
    return jsonResponse({ data: serializeDeal(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.write");
    const { id } = dealIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await dealService.deleteDeal(ctx.dealershipId, ctx.userId, id, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
