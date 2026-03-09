import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardAnyPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import * as profitService from "@/modules/accounting-core/service/profit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["deals.read", "finance.submissions.read"]);
    const { id } = await params;
    const profit = await profitService.calculateDealProfit(ctx.dealershipId, id);
    return jsonResponse({
      frontEndGrossCents: profit.frontEndGrossCents.toString(),
      backEndGrossCents: profit.backEndGrossCents.toString(),
      totalGrossCents: profit.totalGrossCents.toString(),
      feesCents: profit.feesCents.toString(),
      productsCents: profit.productsCents.toString(),
      netProfitCents: profit.netProfitCents.toString(),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
