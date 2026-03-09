import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as complianceService from "@/modules/finance-core/service/compliance";
import { generateComplianceFormBodySchema } from "@/modules/finance-core/schemas-compliance";
import type { ComplianceFormType } from "@prisma/client";

export const dynamic = "force-dynamic";

function serializeForm(instance: {
  id: string;
  dealId: string;
  formType: string;
  status: string;
  generatedPayloadJson: unknown;
  generatedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const payload =
    instance.generatedPayloadJson != null &&
    typeof instance.generatedPayloadJson === "object" &&
    !Array.isArray(instance.generatedPayloadJson)
      ? (instance.generatedPayloadJson as object)
      : null;
  return {
    id: instance.id,
    dealId: instance.dealId,
    formType: instance.formType,
    status: instance.status,
    generatedPayloadJson: payload,
    generatedAt: instance.generatedAt?.toISOString() ?? null,
    completedAt: instance.completedAt?.toISOString() ?? null,
    createdAt: instance.createdAt.toISOString(),
    updatedAt: instance.updatedAt.toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const body = await request.json();
    const parsed = generateComplianceFormBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await complianceService.generateComplianceForm(
      ctx.dealershipId,
      ctx.userId,
      parsed.dealId,
      parsed.formType as ComplianceFormType,
      meta
    );
    if (!created) throw new Error("Compliance form generation did not return an instance");
    return jsonResponse({ data: serializeForm(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
