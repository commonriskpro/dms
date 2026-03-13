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
import { parsePagination } from "@/lib/api/pagination";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

const createBodySchema = z.object({
  name: z.string().min(1),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.dealership.read");
    const { limit, offset } = parsePagination(getQueryObject(request));
    const { data, total } = await dealershipService.listLocations(ctx.dealershipId, limit, offset);
    return jsonResponse(
      listPayload(
        data.map((loc) => ({
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
        total,
        limit,
        offset
      )
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "admin.dealership.write");
    const body = await readSanitizedJson(request);
    const data = createBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await dealershipService.createLocation(
      ctx.dealershipId,
      ctx.userId,
      {
        name: data.name,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        region: data.region,
        postalCode: data.postalCode,
        country: data.country,
        isPrimary: data.isPrimary,
      },
      meta
    );
    return jsonResponse({
      id: created.id,
      dealershipId: created.dealershipId,
      name: created.name,
      addressLine1: created.addressLine1,
      addressLine2: created.addressLine2,
      city: created.city,
      region: created.region,
      postalCode: created.postalCode,
      country: created.country,
      isPrimary: created.isPrimary,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
