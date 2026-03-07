import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as expensesService from "@/modules/accounting-core/service/expenses";
import { listExpensesQuerySchema, createExpenseBodySchema } from "@/modules/accounting-core/schemas";
import type { DealershipExpenseStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function serializeExpense(exp: {
  id: string;
  dealershipId: string;
  vehicleId: string | null;
  dealId: string | null;
  category: string;
  vendor: string | null;
  description: string | null;
  amountCents: bigint;
  incurredOn: Date;
  status: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: exp.id,
    dealershipId: exp.dealershipId,
    vehicleId: exp.vehicleId,
    dealId: exp.dealId,
    category: exp.category,
    vendor: exp.vendor,
    description: exp.description,
    amountCents: exp.amountCents.toString(),
    incurredOn: exp.incurredOn.toISOString().slice(0, 10),
    status: exp.status,
    createdByUserId: exp.createdByUserId,
    createdAt: exp.createdAt.toISOString(),
    updatedAt: exp.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listExpensesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
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
    return jsonResponse({
      data: data.map(serializeExpense),
      meta: { total, limit: query.limit, offset: query.offset },
    });
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
    const body = createExpenseBodySchema.parse(await request.json());
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
