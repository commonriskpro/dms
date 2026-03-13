import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as complianceService from "@/modules/finance-core/service/compliance";
import { updateComplianceFormBodySchema } from "@/modules/finance-core/schemas-compliance";
import { serializeComplianceForm } from "@/modules/finance-core/serialize";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.string().uuid() });

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
    return jsonResponse({ data: serializeComplianceForm(instance) });
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
    const body = await readSanitizedJson(request);
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
    return jsonResponse({ data: serializeComplianceForm(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
