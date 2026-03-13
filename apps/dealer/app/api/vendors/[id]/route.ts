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
  vendorIdParamSchema,
  updateVendorBodySchema,
} from "@/modules/vendors/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { errorResponse } from "@/lib/api/errors";
import { serializeVendor } from "@/modules/vendors/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = vendorIdParamSchema.parse(await context.params);
    const vendor = await vendorService.getVendor(ctx.dealershipId, id);
    if (!vendor) {
      return Response.json(
        errorResponse("NOT_FOUND", "Vendor not found"),
        { status: 404 }
      );
    }
    return jsonResponse({ data: serializeVendor(vendor) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id } = vendorIdParamSchema.parse(await context.params);
    const body = updateVendorBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const updated = await vendorService.updateVendor(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        name: body.name,
        type: body.type,
        contactName: body.contactName ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        notes: body.notes ?? null,
        isActive: body.isActive,
      },
      meta
    );
    if (!updated) {
      return Response.json(
        errorResponse("NOT_FOUND", "Vendor not found"),
        { status: 404 }
      );
    }
    return jsonResponse({ data: serializeVendor(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

/** Soft-delete vendor. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id } = vendorIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    const updated = await vendorService.deleteVendor(
      ctx.dealershipId,
      ctx.userId,
      id,
      meta
    );
    if (!updated) {
      return Response.json(
        errorResponse("NOT_FOUND", "Vendor not found"),
        { status: 404 }
      );
    }
    return jsonResponse({ data: serializeVendor(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
