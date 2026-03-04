import { NextRequest } from "next/server";
import { z } from "zod";
import * as financeService from "@/modules/finance-shell/service";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { dealIdParamSchema, putFinanceBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDealFinance } from "../../serialize";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.read");
    const { id } = dealIdParamSchema.parse(await context.params);
    const result = await financeService.getFinanceByDealId(ctx.dealershipId, id);
    if (!result) {
      const { errorResponse } = await import("@/lib/api/errors");
      return Response.json(
        errorResponse("NOT_FOUND", "Deal finance not found"),
        { status: 404 }
      );
    }
    const data = {
      ...serializeDealFinance(result.finance),
      baseAmountCents: String(result.deal.totalDueCents),
    };
    return jsonResponse({ data });
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
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = await request.json();
    const data = putFinanceBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const { finance, created } = await financeService.putFinance(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        financingMode: data.financingMode,
        termMonths: data.termMonths,
        aprBps: data.aprBps,
        cashDownCents: data.cashDownCents,
        firstPaymentDate: data.firstPaymentDate,
        lenderName: data.lenderName,
        notes: data.notes,
        reserveCents: data.reserveCents,
      },
      meta
    );
    return jsonResponse(
      { data: serializeDealFinance(finance) },
      created ? 201 : 200
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
