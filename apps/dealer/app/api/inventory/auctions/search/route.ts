import { NextRequest } from "next/server";
import { z } from "zod";
import * as auctionService from "@/modules/inventory/service/auction";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

const searchQuerySchema = z.object({
  provider: z.enum(["MOCK"]).optional(),
  vin: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.auctions.read");
    const query = searchQuerySchema.parse(getQueryObject(request));
    const data = await auctionService.searchAuctionListings(ctx.dealershipId, {
      provider: query.provider,
      vin: query.vin,
      make: query.make,
      model: query.model,
      year: query.year,
    }, query.limit);
    return jsonResponse({
      data: data.map((row) => ({
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
      })),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
