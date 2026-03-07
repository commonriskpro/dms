import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as transactionsService from "@/modules/accounting-core/service/transactions";
import { listTransactionsQuerySchema, createTransactionBodySchema } from "@/modules/accounting-core/schemas";
import type { AccountingReferenceType } from "@prisma/client";

export const dynamic = "force-dynamic";

function serializeTransaction(tx: {
  id: string;
  dealershipId: string;
  referenceType: string;
  referenceId: string | null;
  memo: string | null;
  postedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  entries?: { id: string; direction: string; amountCents: bigint; accountId: string }[];
}) {
  return {
    id: tx.id,
    dealershipId: tx.dealershipId,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    memo: tx.memo,
    postedAt: tx.postedAt?.toISOString() ?? null,
    createdByUserId: tx.createdByUserId,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt.toISOString(),
    entries: tx.entries?.map((e) => ({
      id: e.id,
      direction: e.direction,
      amountCents: e.amountCents.toString(),
      accountId: e.accountId,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listTransactionsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
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
    return jsonResponse({
      data: data.map(serializeTransaction),
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
    const body = createTransactionBodySchema.parse(await request.json());
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
