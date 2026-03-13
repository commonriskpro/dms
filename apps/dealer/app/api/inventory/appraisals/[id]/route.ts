import { NextRequest } from "next/server";
import { z } from "zod";
import * as appraisalService from "@/modules/inventory/service/appraisal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { updateAppraisalBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { toBigIntOrUndefined } from "@/lib/bigint";
import { serializeAppraisal } from "@/modules/inventory/serialize-appraisal";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.appraisals.read");
    const { id } = await params;
    const row = await appraisalService.getAppraisal(ctx.dealershipId, id);
    return jsonResponse({ data: serializeAppraisal(row) });
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
    const body = await readSanitizedJson(request);
    const data = updateAppraisalBodySchema.parse(body);
    const updated = await appraisalService.updateAppraisal(ctx.dealershipId, id, {
      acquisitionCostCents: toBigIntOrUndefined(data.acquisitionCostCents),
      reconEstimateCents: toBigIntOrUndefined(data.reconEstimateCents),
      transportEstimateCents: toBigIntOrUndefined(data.transportEstimateCents),
      feesEstimateCents: toBigIntOrUndefined(data.feesEstimateCents),
      expectedRetailCents: toBigIntOrUndefined(data.expectedRetailCents),
      expectedWholesaleCents: toBigIntOrUndefined(data.expectedWholesaleCents),
      expectedTradeInCents: toBigIntOrUndefined(data.expectedTradeInCents),
      expectedProfitCents: toBigIntOrUndefined(data.expectedProfitCents),
      notes: data.notes,
    });
    return jsonResponse({ data: serializeAppraisal(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
