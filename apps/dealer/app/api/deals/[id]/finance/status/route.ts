import { NextRequest } from "next/server";
import { z } from "zod";
import * as financeService from "@/modules/finance-shell/service";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { dealIdParamSchema, patchFinanceStatusBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeDealFinance } from "../../../serialize";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.write");
    const { id } = dealIdParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const { status } = patchFinanceStatusBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const finance = await financeService.patchFinanceStatus(
      ctx.dealershipId,
      ctx.userId,
      id,
      status,
      meta
    );
    return jsonResponse({ data: serializeDealFinance(finance) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
