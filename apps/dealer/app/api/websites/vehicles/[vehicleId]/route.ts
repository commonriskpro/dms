import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as vsService from "@/modules/websites-core/service/vehicle-settings";
import { serializeVehicleSettings } from "@/modules/websites-core/serialize";
import { updateVehicleWebsiteSettingsBodySchema } from "@/modules/websites-core/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.read");
    const { vehicleId } = z.object({ vehicleId: z.string().uuid() }).parse(params);
    const settings = await vsService.getVehicleWebsiteSettings(ctx.dealershipId, vehicleId);
    return jsonResponse({ data: settings ? serializeVehicleSettings(settings) : null });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { vehicleId: string } }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const { vehicleId } = z.object({ vehicleId: z.string().uuid() }).parse(params);
    const body = updateVehicleWebsiteSettingsBodySchema.parse(await readSanitizedJson(request));
    const updated = await vsService.upsertVehicleWebsiteSettings(
      ctx.dealershipId,
      vehicleId,
      body
    );
    return jsonResponse({ data: serializeVehicleSettings(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
