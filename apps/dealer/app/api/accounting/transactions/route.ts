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
import * as transactionsService from "@/modules/accounting-core/service/transactions";
import { listTransactionsQuerySchema, createTransactionBodySchema } from "@/modules/accounting-core/schemas";
import { serializeTransaction } from "@/modules/accounting-core/serialize";
import type { AccountingReferenceType } from "@prisma/client";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listTransactionsQuerySchema.parse(getQueryObject(request));
    const postedFrom = query.postedFrom ? new Date(query.postedFrom) : undefined;
    const postedTo = query.postedTo ? new Date(query.postedTo) : undefined;
    const { data, total } = await transactionsService.listTransactions(
      ctx.dealershipId,
      {
        referenceType: query.referenceType as AccountingReferenceType | undefined,
        referenceId: query.referenceId,
        postedFrom,
        postedTo,
        limit: query.limit,
        offset: query.offset,
      }
    );
    return jsonResponse(
      listPayload(data.map(serializeTransaction), total, query.limit, query.offset)
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
    const body = createTransactionBodySchema.parse(await readSanitizedJson(request));
    const tx = await transactionsService.createTransaction(
      ctx.dealershipId,
      ctx.userId,
      {
        referenceType: body.referenceType,
        referenceId: body.referenceId ?? null,
        memo: body.memo ?? null,
      },
      { userAgent: request.headers.get("user-agent") ?? undefined }
    );
    return jsonResponse(serializeTransaction(tx));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
