import { NextRequest } from "next/server";
import { z } from "zod";
import * as pricingService from "@/modules/inventory/service/pricing";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { updatePricingRuleBodySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.pricing.write");
    const { id } = await params;
    const body = await readSanitizedJson(request);
    const data = updatePricingRuleBodySchema.parse(body);
    const updated = await pricingService.updatePricingRule(ctx.dealershipId, id, data);
    return jsonResponse({
      data: {
        id: updated.id,
        name: updated.name,
        ruleType: updated.ruleType,
        daysInStock: updated.daysInStock,
        adjustmentPercent: updated.adjustmentPercent,
        adjustmentCents: updated.adjustmentCents,
        enabled: updated.enabled,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
