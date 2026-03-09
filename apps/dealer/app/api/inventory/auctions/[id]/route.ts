import { NextRequest } from "next/server";
import * as auctionService from "@/modules/inventory/service/auction";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.auctions.read");
    const { id } = await params;
    const row = await auctionService.getAuctionListing(ctx.dealershipId, id);
    return jsonResponse({
      data: {
        id: row.id,
        provider: row.provider,
        auctionLotId: row.auctionLotId,
        vin: row.vin,
        year: row.year,
        make: row.make,
        model: row.model,
        mileage: row.mileage,
        currentBidCents: row.currentBidCents?.toString() ?? null,
        buyNowCents: row.buyNowCents?.toString() ?? null,
        auctionEndAt: row.auctionEndAt?.toISOString() ?? null,
        location: row.location,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
