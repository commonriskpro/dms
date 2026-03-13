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
import { addEntryBodySchema } from "@/modules/accounting-core/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id: transactionId } = await params;
    const body = addEntryBodySchema.parse(await readSanitizedJson(request));
    const entry = await transactionsService.addEntry(
      ctx.dealershipId,
      ctx.userId,
      transactionId,
      {
        accountId: body.accountId,
        direction: body.direction,
        amountCents: body.amountCents,
        memo: body.memo ?? null,
      },
      { userAgent: request.headers.get("user-agent") ?? undefined }
    );
    return jsonResponse({
      id: entry.id,
      transactionId: entry.transactionId,
      accountId: entry.accountId,
      direction: entry.direction,
      amountCents: entry.amountCents.toString(),
      memo: entry.memo,
      createdAt: entry.createdAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
