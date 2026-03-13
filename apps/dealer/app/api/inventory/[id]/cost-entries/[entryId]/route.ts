import { NextRequest } from "next/server";
import { z } from "zod";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import * as vendorService from "@/modules/vendors/service/vendor";
import { getAuthContext, guardPermission, handleApiError, jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { getRequestMeta } from "@/lib/api/handler";
import { costEntryIdParamSchema, costEntryUpdateBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id, entryId } = costEntryIdParamSchema.parse(await context.params);
    const entry = await costLedger.getCostEntry(ctx.dealershipId, entryId);
    if (entry.vehicleId !== id) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Cost entry not found" } },
        { status: 404 }
      );
    }
    const body = await readSanitizedJson(request);
    const data = costEntryUpdateBodySchema.parse(body);
    if (data.vendorId !== undefined && data.vendorId != null && data.vendorId.trim() !== "") {
      const vendor = await vendorService.getVendor(ctx.dealershipId, data.vendorId);
      if (!vendor) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Vendor not found", details: [{ path: ["vendorId"], message: "Vendor must belong to your dealership" }] } },
          { status: 400 }
        );
      }
    }
    const meta = getRequestMeta(request);
    const updatePayload: costLedger.UpdateCostEntryInput = {};
    if (data.description !== undefined) updatePayload.description = data.description ?? null;
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.amountCents !== undefined)
      updatePayload.amountCents =
        typeof data.amountCents === "string" ? BigInt(data.amountCents) : BigInt(data.amountCents);
    if (data.vendorId !== undefined) updatePayload.vendorId = data.vendorId ?? null;
    if (data.vendorName !== undefined) updatePayload.vendorName = data.vendorName ?? null;
    if (data.occurredAt !== undefined) updatePayload.occurredAt = new Date(data.occurredAt);
    if (data.memo !== undefined) updatePayload.memo = data.memo ?? null;

    const updated = await costLedger.updateCostEntry(ctx.dealershipId, entryId, updatePayload, meta);
    if (!updated) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Cost entry not found" } },
        { status: 404 }
      );
    }
    const u = updated as typeof updated & { vendor?: { name: string } | null };
    return jsonResponse({
      data: {
        id: u.id,
        vehicleId: u.vehicleId,
        description: u.description,
        category: u.category,
        amountCents: u.amountCents.toString(),
        vendorId: u.vendorId,
        vendorName: u.vendorName,
        vendorDisplayName: u.vendorName ?? u.vendor?.name ?? null,
        occurredAt: u.occurredAt instanceof Date ? u.occurredAt.toISOString() : u.occurredAt,
        memo: u.memo,
        createdByUserId: u.createdByUserId,
        createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
        updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : u.updatedAt,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id, entryId } = costEntryIdParamSchema.parse(await context.params);
    const entry = await costLedger.getCostEntry(ctx.dealershipId, entryId);
    if (entry.vehicleId !== id) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Cost entry not found" } },
        { status: 404 }
      );
    }
    const meta = getRequestMeta(request);
    await costLedger.deleteCostEntry(ctx.dealershipId, entryId, ctx.userId, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
