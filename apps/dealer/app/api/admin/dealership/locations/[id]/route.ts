import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealershipService from "@/modules/core-platform/service/dealership";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  parseUuidParam,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";

const patchBodySchema = z.object({
  name: z.string().min(1).optional(),
  addressLine1: z.string().nullable().optional(),
  addressLine2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.dealership.write");
    const { id } = await params;
    const locationId = parseUuidParam(id);
    const body = await readSanitizedJson(request);
    const data = patchBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await dealershipService.updateLocation(
      ctx.dealershipId,
      locationId,
      ctx.userId,
      data,
      meta
    );
    return jsonResponse({
      id: updated.id,
      dealershipId: updated.dealershipId,
      name: updated.name,
      addressLine1: updated.addressLine1,
      addressLine2: updated.addressLine2,
      city: updated.city,
      region: updated.region,
      postalCode: updated.postalCode,
      country: updated.country,
      isPrimary: updated.isPrimary,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
