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
import { updateComplianceFormBodySchema } from "@/modules/finance-core/schemas-compliance";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.string().uuid() });

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id } = idParamSchema.parse(await context.params);
    const instance = await complianceService.getComplianceFormInstance(
      ctx.dealershipId,
      id
    );
    return jsonResponse({ data: serializeForm(instance) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = await request.json();
    const parsed = updateComplianceFormBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await complianceService.updateComplianceFormInstance(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        status: parsed.status,
        completedAt: parsed.completedAt ?? undefined,
      },
      meta
    );
    return jsonResponse({ data: serializeForm(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
