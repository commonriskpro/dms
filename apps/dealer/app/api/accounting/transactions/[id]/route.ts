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
  dealershipId: string;
  referenceType: string;
  referenceId: string | null;
  memo: string | null;
  postedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  entries: { id: string; direction: string; amountCents: bigint; accountId: string; account: { code: string; name: string } }[];
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
    entries: tx.entries.map((e) => ({
      id: e.id,
      direction: e.direction,
      amountCents: e.amountCents.toString(),
      accountId: e.accountId,
      account: e.account,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id } = await params;
    const tx = await transactionsService.getTransaction(ctx.dealershipId, id);
    return jsonResponse(serializeTransaction(tx));
  } catch (e) {
    return handleApiError(e);
  }
}
