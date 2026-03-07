import { NextRequest } from "next/server";
import { z } from "zod";
import * as appraisalService from "@/modules/inventory/service/appraisal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { updateAppraisalBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

/** Accepts both getAppraisal (full vehicle) and updateAppraisal (narrow vehicle) return shapes. */
function toAppraisalResponse(
  row: Awaited<ReturnType<typeof appraisalService.getAppraisal>> | Awaited<ReturnType<typeof appraisalService.updateAppraisal>>
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
    vehicle: row.vehicle,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.appraisals.read");
    const { id } = await params;
    const row = await appraisalService.getAppraisal(ctx.dealershipId, id);
    return jsonResponse({ data: toAppraisalResponse(row) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.appraisals.write");
    const { id } = await params;
    const body = await request.json();
    const data = updateAppraisalBodySchema.parse(body);
    const updated = await appraisalService.updateAppraisal(ctx.dealershipId, id, {
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
    return jsonResponse({ data: toAppraisalResponse(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
