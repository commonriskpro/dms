import { NextRequest } from "next/server";
import * as appraisalService from "@/modules/inventory/service/appraisal";
import { toVehicleResponse } from "@/modules/inventory/api-response";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
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
    const meta = getRequestMeta(request);
    const { vehicle, appraisal } = await appraisalService.convertAppraisalToInventory(
      ctx.dealershipId,
      ctx.userId,
      id,
      meta
    );
    return jsonResponse({
      data: {
        vehicle: toVehicleResponse(vehicle!),
        appraisal: {
          id: appraisal!.id,
          status: appraisal!.status,
          vehicleId: appraisal!.vehicleId,
        },
      },
    }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
