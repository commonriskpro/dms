import { NextRequest } from "next/server";
import { z } from "zod";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
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
    const body = await request.json();
    const data = costEntryUpdateBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updatePayload: costLedger.UpdateCostEntryInput = {};
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.amountCents !== undefined)
      updatePayload.amountCents =
        typeof data.amountCents === "string" ? BigInt(data.amountCents) : BigInt(data.amountCents);
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
    return jsonResponse({
      data: {
        id: updated.id,
        vehicleId: updated.vehicleId,
        category: updated.category,
        amountCents: updated.amountCents.toString(),
        vendorName: updated.vendorName,
        occurredAt: updated.occurredAt instanceof Date ? updated.occurredAt.toISOString() : updated.occurredAt,
        memo: updated.memo,
        createdByUserId: updated.createdByUserId,
        createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
        updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : updated.updatedAt,
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
