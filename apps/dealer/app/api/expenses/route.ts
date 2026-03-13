import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as expensesService from "@/modules/accounting-core/service/expenses";
import { listExpensesQuerySchema, createExpenseBodySchema } from "@/modules/accounting-core/schemas";
import { serializeExpense } from "@/modules/accounting-core/serialize";
import type { DealershipExpenseStatus } from "@prisma/client";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listExpensesQuerySchema.parse(getQueryObject(request));
    const incurredFrom = query.incurredFrom ? new Date(query.incurredFrom) : undefined;
    const incurredTo = query.incurredTo ? new Date(query.incurredTo) : undefined;
    const { data, total } = await expensesService.listExpenses(ctx.dealershipId, {
      status: query.status as DealershipExpenseStatus | undefined,
      dealId: query.dealId,
      vehicleId: query.vehicleId,
      incurredFrom,
      incurredTo,
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse(
      listPayload(data.map(serializeExpense), total, query.limit, query.offset)
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const body = createExpenseBodySchema.parse(await readSanitizedJson(request));
    const incurredOn = new Date(body.incurredOn);
    const expense = await expensesService.createExpense(
      ctx.dealershipId,
      ctx.userId,
      {
        dealershipId: ctx.dealershipId,
        vehicleId: body.vehicleId ?? null,
        dealId: body.dealId ?? null,
        category: body.category,
        vendor: body.vendor ?? null,
        description: body.description ?? null,
        amountCents: body.amountCents,
        incurredOn,
        createdByUserId: ctx.userId,
      },
      { userAgent: request.headers.get("user-agent") ?? undefined }
    );
    return jsonResponse(serializeExpense(expense));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
