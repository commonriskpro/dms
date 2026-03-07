import { NextRequest } from "next/server";
import { z } from "zod";
import * as acquisitionService from "@/modules/inventory/service/acquisition";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { updateAcquisitionBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

function serializeAppraisal(
  appraisal: { id: string; vin: string | null; status: string; expectedRetailCents?: bigint; expectedProfitCents?: bigint; vehicleId?: string | null } | null
) {
  if (!appraisal) return null;
  return {
    id: appraisal.id,
    vin: appraisal.vin,
    status: appraisal.status,
    expectedRetailCents: appraisal.expectedRetailCents?.toString() ?? null,
    expectedProfitCents: appraisal.expectedProfitCents?.toString() ?? null,
    vehicleId: appraisal.vehicleId ?? null,
  };
}

function toLeadResponse(row: Awaited<ReturnType<typeof acquisitionService.getInventorySourceLead>>) {
  if (!row) return null;
  return {
    id: row.id,
    vin: row.vin,
    sourceType: row.sourceType,
    sellerName: row.sellerName,
    sellerPhone: row.sellerPhone,
    sellerEmail: row.sellerEmail,
    askingPriceCents: row.askingPriceCents?.toString() ?? null,
    negotiatedPriceCents: row.negotiatedPriceCents?.toString() ?? null,
    status: row.status,
    appraisalId: row.appraisalId,
    appraisal: serializeAppraisal(row.appraisal),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.acquisition.read");
    const { id } = await params;
    const row = await acquisitionService.getInventorySourceLead(ctx.dealershipId, id);
    return jsonResponse({ data: toLeadResponse(row) });
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
    await guardPermission(ctx, "inventory.acquisition.write");
    const { id } = await params;
    const body = await request.json();
    const data = updateAcquisitionBodySchema.parse(body);
    const updated = await acquisitionService.updateInventorySourceLead(ctx.dealershipId, id, {
      sellerName: data.sellerName,
      sellerPhone: data.sellerPhone,
      sellerEmail: data.sellerEmail,
      askingPriceCents: data.askingPriceCents != null ? BigInt(data.askingPriceCents) : undefined,
      negotiatedPriceCents: data.negotiatedPriceCents != null ? BigInt(data.negotiatedPriceCents) : undefined,
      appraisalId: data.appraisalId,
    });
    return jsonResponse({ data: toLeadResponse(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
