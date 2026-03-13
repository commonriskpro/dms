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
import { createPricingRuleBodySchema } from "./schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  enabled: z.enum(["true", "false"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.pricing.read");
    const query = listQuerySchema.parse(getQueryObject(request));
    const data = await pricingService.listPricingRules(
      ctx.dealershipId,
      query.enabled === "true" ? true : query.enabled === "false" ? false : undefined
    );
    return jsonResponse({
      data: data.map((row) => ({
        id: row.id,
        name: row.name,
        ruleType: row.ruleType,
        daysInStock: row.daysInStock,
        adjustmentPercent: row.adjustmentPercent,
        adjustmentCents: row.adjustmentCents,
        enabled: row.enabled,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
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
    await guardPermission(ctx, "inventory.pricing.write");
    const body = await readSanitizedJson(request);
    const data = createPricingRuleBodySchema.parse(body);
    const created = await pricingService.createPricingRule(ctx.dealershipId, {
      name: data.name,
      ruleType: data.ruleType,
      daysInStock: data.daysInStock,
      adjustmentPercent: data.adjustmentPercent,
      adjustmentCents: data.adjustmentCents,
      enabled: data.enabled,
    });
    return jsonResponse({
      data: {
        id: created.id,
        name: created.name,
        ruleType: created.ruleType,
        daysInStock: created.daysInStock,
        adjustmentPercent: created.adjustmentPercent,
        adjustmentCents: created.adjustmentCents,
        enabled: created.enabled,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
