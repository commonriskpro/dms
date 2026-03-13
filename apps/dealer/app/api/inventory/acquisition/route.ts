import { NextRequest } from "next/server";
import { z } from "zod";
import * as acquisitionService from "@/modules/inventory/service/acquisition";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { listAcquisitionQuerySchema, createAcquisitionBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";
import { serializeAcquisitionLead } from "@/modules/inventory/serialize-acquisition";
import { toBigIntOrUndefined } from "@/lib/bigint";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.acquisition.read");
    const query = listAcquisitionQuerySchema.parse(getQueryObject(request));
    const { data, total } = await acquisitionService.listInventorySourceLeads(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: { status: query.status, sourceType: query.sourceType, vin: query.vin },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return jsonResponse(
      listPayload(
        data.map((row) => serializeAcquisitionLead(row)),
        total,
        query.limit,
        query.offset
      )
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
    await guardPermission(ctx, "inventory.acquisition.write");
    const body = await readSanitizedJson(request);
    const data = createAcquisitionBodySchema.parse(body);
    const created = await acquisitionService.createInventorySourceLead(ctx.dealershipId, {
      vin: data.vin,
      sourceType: data.sourceType,
      sellerName: data.sellerName,
      sellerPhone: data.sellerPhone,
      sellerEmail: data.sellerEmail,
      askingPriceCents: toBigIntOrUndefined(data.askingPriceCents),
      negotiatedPriceCents: toBigIntOrUndefined(data.negotiatedPriceCents),
      appraisalId: data.appraisalId,
    });
    return jsonResponse({ data: serializeAcquisitionLead(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
