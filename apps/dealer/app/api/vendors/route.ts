import { NextRequest } from "next/server";
import { z } from "zod";
import * as vendorService from "@/modules/vendors/service/vendor";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  listVendorsQuerySchema,
  createVendorBodySchema,
} from "@/modules/vendors/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeVendor } from "@/modules/vendors/serialize";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

/** List vendors (dealership-scoped). Excludes soft-deleted by default. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const query = listVendorsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await vendorService.listVendors(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      type: query.type,
      includeDeleted: query.includeDeleted,
    });
    return jsonResponse(
      listPayload(data.map(serializeVendor), total, query.limit, query.offset)
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
    await guardPermission(ctx, "inventory.write");
    const body = createVendorBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const created = await vendorService.createVendor(
      ctx.dealershipId,
      ctx.userId,
      {
        name: body.name,
        type: body.type,
        contactName: body.contactName ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        notes: body.notes ?? null,
        isActive: body.isActive ?? true,
      },
      meta
    );
    return jsonResponse({ data: serializeVendor(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
