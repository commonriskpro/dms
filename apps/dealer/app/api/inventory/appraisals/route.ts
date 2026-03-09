import { NextRequest } from "next/server";
import { z } from "zod";
import * as appraisalService from "@/modules/inventory/service/appraisal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { listAppraisalsQuerySchema, createAppraisalBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

/** Accepts getAppraisal, listAppraisals item, createAppraisal, or updateAppraisal return shapes (vehicle may be narrow). */
function toAppraisalResponse(
  row:
    | Awaited<ReturnType<typeof appraisalService.getAppraisal>>
    | Awaited<ReturnType<typeof appraisalService.updateAppraisal>>
    | Awaited<ReturnType<typeof appraisalService.listAppraisals>>["data"][number]
    | Awaited<ReturnType<typeof appraisalService.createAppraisal>>
) {
  if (!row) return null;
  return {
    id: row.id,
    vin: row.vin,
    sourceType: row.sourceType,
    vehicleId: row.vehicleId,
    appraisedBy: row.appraisedBy,
    acquisitionCostCents: row.acquisitionCostCents.toString(),
    reconEstimateCents: row.reconEstimateCents.toString(),
    transportEstimateCents: row.transportEstimateCents.toString(),
    feesEstimateCents: row.feesEstimateCents.toString(),
    expectedRetailCents: row.expectedRetailCents.toString(),
    expectedWholesaleCents: row.expectedWholesaleCents.toString(),
    expectedTradeInCents: row.expectedTradeInCents.toString(),
    expectedProfitCents: row.expectedProfitCents.toString(),
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    vehicle: "vehicle" in row ? row.vehicle ?? null : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.appraisals.read");
    const query = listAppraisalsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await appraisalService.listAppraisals(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: {
        status: query.status,
        sourceType: query.sourceType,
        vin: query.vin,
      },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return jsonResponse({
      data: data.map((row) => toAppraisalResponse(row)),
      meta: { total, limit: query.limit, offset: query.offset },
    });
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
    await guardPermission(ctx, "inventory.appraisals.write");
    const body = await request.json();
    const data = createAppraisalBodySchema.parse(body);
    const created = await appraisalService.createAppraisal(ctx.dealershipId, ctx.userId, {
      vin: data.vin,
      sourceType: data.sourceType,
      acquisitionCostCents: data.acquisitionCostCents != null ? BigInt(data.acquisitionCostCents) : undefined,
      reconEstimateCents: data.reconEstimateCents != null ? BigInt(data.reconEstimateCents) : undefined,
      transportEstimateCents: data.transportEstimateCents != null ? BigInt(data.transportEstimateCents) : undefined,
      feesEstimateCents: data.feesEstimateCents != null ? BigInt(data.feesEstimateCents) : undefined,
      expectedRetailCents: data.expectedRetailCents != null ? BigInt(data.expectedRetailCents) : undefined,
      expectedWholesaleCents: data.expectedWholesaleCents != null ? BigInt(data.expectedWholesaleCents) : undefined,
      expectedTradeInCents: data.expectedTradeInCents != null ? BigInt(data.expectedTradeInCents) : undefined,
      expectedProfitCents: data.expectedProfitCents != null ? BigInt(data.expectedProfitCents) : undefined,
      notes: data.notes,
    });
    return jsonResponse({ data: toAppraisalResponse(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
