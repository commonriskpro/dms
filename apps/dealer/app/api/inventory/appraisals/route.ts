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
import { listAppraisalsQuerySchema, createAppraisalBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";
import { toBigIntOrUndefined } from "@/lib/bigint";
import { serializeAppraisal } from "@/modules/inventory/serialize-appraisal";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.appraisals.read");
    const query = listAppraisalsQuerySchema.parse(getQueryObject(request));
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
    return jsonResponse(
      listPayload(
        data.map((row) => serializeAppraisal(row)),
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
    await guardPermission(ctx, "inventory.appraisals.write");
    const body = await readSanitizedJson(request);
    const data = createAppraisalBodySchema.parse(body);
    const created = await appraisalService.createAppraisal(ctx.dealershipId, ctx.userId, {
      vin: data.vin,
      sourceType: data.sourceType,
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
    return jsonResponse({ data: serializeAppraisal(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
