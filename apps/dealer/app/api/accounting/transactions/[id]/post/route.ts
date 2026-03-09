import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import * as transactionsService from "@/modules/accounting-core/service/transactions";
import { serializeTransaction } from "@/modules/accounting-core/serialize";

export const dynamic = "force-dynamic";

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
