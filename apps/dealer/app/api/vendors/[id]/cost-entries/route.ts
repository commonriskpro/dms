import { NextRequest } from "next/server";
import { z } from "zod";
import * as vendorService from "@/modules/vendors/service/vendor";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { vendorIdParamSchema } from "@/modules/vendors/schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

/** List recent cost entries for a vendor (dealership-scoped). Limit 25. */
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
        { error: { code: "NOT_FOUND", message: "Vendor not found" } },
        { status: 404 }
      );
    }
    const limit = Math.min(
      Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 25),
      100
    );
    const entries = await costLedger.listCostEntriesByVendor(
      ctx.dealershipId,
      id,
      limit
    );
    return jsonResponse({
      data: entries.map((e) => ({
        id: e.id,
        vehicleId: e.vehicleId,
        vehicleSummary:
          e.vehicle != null
            ? [e.vehicle.year, e.vehicle.make, e.vehicle.model]
                .filter(Boolean)
                .join(" ") || e.vehicle.stockNumber
            : null,
        stockNumber: e.vehicle?.stockNumber ?? null,
        category: e.category,
        amountCents: e.amountCents.toString(),
        occurredAt:
          e.occurredAt instanceof Date ? e.occurredAt.toISOString() : e.occurredAt,
        memo: e.memo,
      })),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
