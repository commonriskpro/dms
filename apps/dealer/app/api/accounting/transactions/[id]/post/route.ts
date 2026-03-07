import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import * as transactionsService from "@/modules/accounting-core/service/transactions";

export const dynamic = "force-dynamic";

function serializeTransaction(tx: {
  id: string;
  referenceType: string;
  referenceId: string | null;
  memo: string | null;
  postedAt: Date | null;
  createdAt: Date;
  entries: { id: string; direction: string; amountCents: bigint; accountId: string }[];
}) {
  return {
    id: tx.id,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
    memo: tx.memo,
    postedAt: tx.postedAt?.toISOString() ?? null,
    createdAt: tx.createdAt.toISOString(),
    entries: tx.entries.map((e) => ({
      id: e.id,
      direction: e.direction,
      amountCents: e.amountCents.toString(),
      accountId: e.accountId,
    })),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id } = await params;
    const tx = await transactionsService.postTransaction(
      ctx.dealershipId,
      ctx.userId,
      id,
      { userAgent: request.headers.get("user-agent") ?? undefined }
    );
    if (!tx) throw new Error("Transaction not found");
    return jsonResponse(serializeTransaction(tx));
  } catch (e) {
    return handleApiError(e);
  }
}
