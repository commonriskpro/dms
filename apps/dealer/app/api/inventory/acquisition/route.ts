import { NextRequest } from "next/server";
import { z } from "zod";
import * as acquisitionService from "@/modules/inventory/service/acquisition";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { listAcquisitionQuerySchema, createAcquisitionBodySchema } from "./schemas";
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
    expectedRetailCents: (appraisal as { expectedRetailCents?: bigint }).expectedRetailCents?.toString() ?? null,
    expectedProfitCents: (appraisal as { expectedProfitCents?: bigint }).expectedProfitCents?.toString() ?? null,
    vehicleId: (appraisal as { vehicleId?: string | null }).vehicleId ?? null,
  };
}

function toLeadResponse(row: Awaited<ReturnType<typeof acquisitionService.getInventorySourceLead>> | { id: string; vin: string; sourceType: string; sellerName: string | null; sellerPhone: string | null; sellerEmail: string | null; askingPriceCents: bigint | null; negotiatedPriceCents: bigint | null; status: string; appraisalId: string | null; appraisal: unknown; createdAt: Date; updatedAt: Date }) {
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
    appraisal: serializeAppraisal(row.appraisal as Parameters<typeof serializeAppraisal>[0]),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.acquisition.read");
    const query = listAcquisitionQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await acquisitionService.listInventorySourceLeads(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: { status: query.status, sourceType: query.sourceType, vin: query.vin },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return jsonResponse({
      data: data.map((row) => toLeadResponse(row)),
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
    await guardPermission(ctx, "inventory.acquisition.write");
    const body = await request.json();
    const data = createAcquisitionBodySchema.parse(body);
    const created = await acquisitionService.createInventorySourceLead(ctx.dealershipId, {
      vin: data.vin,
      sourceType: data.sourceType,
      sellerName: data.sellerName,
      sellerPhone: data.sellerPhone,
      sellerEmail: data.sellerEmail,
      askingPriceCents: data.askingPriceCents != null ? BigInt(data.askingPriceCents) : undefined,
      negotiatedPriceCents: data.negotiatedPriceCents != null ? BigInt(data.negotiatedPriceCents) : undefined,
      appraisalId: data.appraisalId,
    });
    return jsonResponse({ data: toLeadResponse(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
