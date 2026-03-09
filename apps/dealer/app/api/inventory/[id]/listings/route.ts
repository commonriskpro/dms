import { NextRequest } from "next/server";
import * as listingsService from "@/modules/inventory/service/listings";
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
    await guardPermission(ctx, "inventory.read");
    const { id } = await params;
    const data = await listingsService.listVehicleListings(ctx.dealershipId, id);
    return jsonResponse({
      data: data.map((row) => ({
        id: row.id,
        vehicleId: row.vehicleId,
        platform: row.platform,
        status: row.status,
        externalListingId: row.externalListingId,
        lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
