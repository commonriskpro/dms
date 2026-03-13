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
import { updateExpenseBodySchema } from "@/modules/accounting-core/schemas";
import { serializeExpense } from "@/modules/accounting-core/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id } = await params;
    const expense = await expensesService.getExpense(ctx.dealershipId, id);
    return jsonResponse(serializeExpense(expense));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id } = await params;
    const body = updateExpenseBodySchema.parse(await readSanitizedJson(request));
    const update: {
      category?: string;
      vendor?: string | null;
      description?: string | null;
      amountCents?: bigint;
      vehicleId?: string | null;
      dealId?: string | null;
      incurredOn?: Date;
      status?: "OPEN" | "POSTED" | "VOID";
    } = {};
    if (body.category !== undefined) update.category = body.category;
    if (body.vendor !== undefined) update.vendor = body.vendor;
    if (body.description !== undefined) update.description = body.description;
    if (body.amountCents !== undefined) update.amountCents = body.amountCents;
    if (body.vehicleId !== undefined) update.vehicleId = body.vehicleId;
    if (body.dealId !== undefined) update.dealId = body.dealId;
    if (body.incurredOn !== undefined) update.incurredOn = new Date(body.incurredOn);
    if (body.status !== undefined) update.status = body.status;
    const expense = await expensesService.updateExpense(
      ctx.dealershipId,
      ctx.userId,
      id,
      update,
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
