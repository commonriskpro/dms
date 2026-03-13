import { NextRequest } from "next/server";
import { z } from "zod";
import * as listingsService from "@/modules/inventory/service/listings";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { idParamSchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

const unpublishBodySchema = z.object({
  platform: z.enum(["WEBSITE", "AUTOTRADER", "CARS", "CARFAX", "FACEBOOK"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.publish.write");
    const { id } = idParamSchema.parse(await params);
    const body = await readSanitizedJson(request);
    const { platform } = unpublishBodySchema.parse(body);
    const listing = await listingsService.unpublishVehicleListing(ctx.dealershipId, id, platform);
    return jsonResponse({
      data: listing
        ? {
            id: listing.id,
            vehicleId: listing.vehicleId,
            platform: listing.platform,
            status: listing.status,
          }
        : null,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
