import { NextRequest } from "next/server";
import { z } from "zod";
import * as dealershipService from "@/modules/core-platform/service/dealership";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.dealership.read");
    const dealership = await dealershipService.getDealershipWithLocations(ctx.dealershipId);
    return jsonResponse({
      dealership: {
        id: dealership.id,
        name: dealership.name,
        slug: dealership.slug ?? undefined,
        settings: dealership.settings ?? undefined,
        createdAt: dealership.createdAt,
        updatedAt: dealership.updatedAt,
      },
      locations: dealership.locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        addressLine1: loc.addressLine1,
        addressLine2: loc.addressLine2,
        city: loc.city,
        region: loc.region,
        postalCode: loc.postalCode,
        country: loc.country,
        isPrimary: loc.isPrimary,
        createdAt: loc.createdAt,
        updatedAt: loc.updatedAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const patchBodySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.dealership.write");
    const body = await readSanitizedJson(request);
    const data = patchBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await dealershipService.updateDealership(
      ctx.dealershipId,
      ctx.userId,
      data,
      meta
    );
    return jsonResponse({
      id: updated.id,
      name: updated.name,
      slug: updated.slug ?? undefined,
      settings: updated.settings ?? undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
