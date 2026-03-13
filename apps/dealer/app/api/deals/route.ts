import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import * as dealService from "@/modules/deals/service/deal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { listDealsQuerySchema, createDealBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDeal } from "./serialize";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const query = listDealsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await dealService.listDeals(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      filters: {
        status: query.status,
        customerId: query.customerId,
        vehicleId: query.vehicleId,
      },
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
    return jsonResponse(
      listPayload(
        data.map((d) => serializeDeal(d)),
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
    await guardPermission(ctx, "deals.write");
    const body = await readSanitizedJson(request);
    const data = createDealBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await dealService.createDeal(ctx.dealershipId, ctx.userId, {
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      financingMode: data.financingMode,
      salePriceCents: data.salePriceCents,
      purchasePriceCents: data.purchasePriceCents,
      taxRateBps: data.taxRateBps,
      docFeeCents: data.docFeeCents,
      downPaymentCents: data.downPaymentCents,
      notes: data.notes,
      fees: data.fees?.map((f) => ({
        label: f.label,
        amountCents: f.amountCents,
        taxable: f.taxable,
      })),
    }, meta);
    revalidatePath("/deals");
    return jsonResponse({ data: serializeDeal(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
