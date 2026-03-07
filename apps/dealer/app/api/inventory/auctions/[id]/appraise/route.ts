import { NextRequest } from "next/server";
import * as auctionService from "@/modules/inventory/service/auction";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.appraisals.write");
    const { id } = await params;
    const created = await auctionService.createAppraisalFromAuction(ctx.dealershipId, ctx.userId, id);
    return jsonResponse({
      data: {
        id: created.id,
        vin: created.vin,
        sourceType: created.sourceType,
        status: created.status,
        expectedRetailCents: created.expectedRetailCents.toString(),
        expectedProfitCents: created.expectedProfitCents.toString(),
      },
    }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
