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
import { generateComplianceFormBodySchema } from "@/modules/finance-core/schemas-compliance";
import { serializeComplianceForm } from "@/modules/finance-core/serialize";
import type { ComplianceFormType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const body = await readSanitizedJson(request);
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
    return jsonResponse({ data: serializeComplianceForm(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
