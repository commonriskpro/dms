import { NextRequest } from "next/server";
import { z } from "zod";
import * as inventoryService from "@/modules/inventory/service/vehicle";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import * as vendorService from "@/modules/vendors/service/vendor";
import { getAuthContext, guardPermission, handleApiError, jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { getRequestMeta } from "@/lib/api/handler";
import { idParamSchema } from "../../schemas";
import { costEntryCreateBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    await inventoryService.getVehicle(ctx.dealershipId, id);
    const entries = await costLedger.listCostEntries(ctx.dealershipId, id);
    return jsonResponse({
      data: entries.map((e) => {
        const vendor = (e as { vendor?: { name: string; type: string } | null }).vendor;
        return {
          id: e.id,
          vehicleId: e.vehicleId,
          description: e.description,
          category: e.category,
          amountCents: e.amountCents.toString(),
          vendorId: e.vendorId,
          vendorName: e.vendorName,
          vendorDisplayName: e.vendorName ?? vendor?.name ?? null,
          vendorType: vendor?.type ?? null,
          occurredAt: e.occurredAt instanceof Date ? e.occurredAt.toISOString() : e.occurredAt,
          memo: e.memo,
          createdByUserId: e.createdByUserId,
          createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
          updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt,
        };
      }),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id } = idParamSchema.parse(await context.params);
    await inventoryService.getVehicle(ctx.dealershipId, id);
    const body = await readSanitizedJson(request);
    const data = costEntryCreateBodySchema.parse(body);
    if (data.vendorId != null && data.vendorId.trim() !== "") {
      const vendor = await vendorService.getVendor(ctx.dealershipId, data.vendorId);
      if (!vendor) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Vendor not found", details: [{ path: ["vendorId"], message: "Vendor must belong to your dealership" }] } },
          { status: 400 }
        );
      }
    }
    const amountCents =
      typeof data.amountCents === "string" ? BigInt(data.amountCents) : BigInt(data.amountCents);
    const occurredAt = new Date(data.occurredAt);
    const meta = getRequestMeta(request);
    const resolvedVendorId = data.vendorId ?? null;
    const resolvedVendorName = data.vendorName ?? null;
    const entry = await costLedger.createCostEntry(
      ctx.dealershipId,
      id,
      ctx.userId,
      {
        description: data.description ?? null,
        category: data.category,
        amountCents,
        vendorId: resolvedVendorId,
        vendorName: resolvedVendorName,
        occurredAt,
        memo: data.memo ?? null,
      },
      meta
    );
    let vendorType: string | null = null;
    if (resolvedVendorId) {
      const vendor = await vendorService.getVendor(ctx.dealershipId, resolvedVendorId);
      vendorType = vendor?.type ?? null;
    }
    return jsonResponse(
      {
        data: {
          id: entry.id,
          vehicleId: entry.vehicleId,
          description: entry.description,
          category: entry.category,
          amountCents: entry.amountCents.toString(),
          vendorId: entry.vendorId,
          vendorName: entry.vendorName,
          vendorDisplayName: entry.vendorName ?? null,
          vendorType,
          occurredAt: entry.occurredAt instanceof Date ? entry.occurredAt.toISOString() : entry.occurredAt,
          memo: entry.memo,
          createdByUserId: entry.createdByUserId,
          createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : entry.createdAt,
          updatedAt: entry.updatedAt instanceof Date ? entry.updatedAt.toISOString() : entry.updatedAt,
        },
      },
      201
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
