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
import { updateAcquisitionBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeAcquisitionLead } from "@/modules/inventory/serialize-acquisition";
import { toBigIntOrUndefined } from "@/lib/bigint";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.acquisition.read");
    const { id } = await params;
    const row = await acquisitionService.getInventorySourceLead(ctx.dealershipId, id);
    return jsonResponse({ data: serializeAcquisitionLead(row) });
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
    const body = await readSanitizedJson(request);
    const data = updateAcquisitionBodySchema.parse(body);
    const updated = await acquisitionService.updateInventorySourceLead(ctx.dealershipId, id, {
      sellerName: data.sellerName,
      sellerPhone: data.sellerPhone,
      sellerEmail: data.sellerEmail,
      askingPriceCents: toBigIntOrUndefined(data.askingPriceCents),
      negotiatedPriceCents: toBigIntOrUndefined(data.negotiatedPriceCents),
      appraisalId: data.appraisalId,
    });
    return jsonResponse({ data: serializeAcquisitionLead(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
