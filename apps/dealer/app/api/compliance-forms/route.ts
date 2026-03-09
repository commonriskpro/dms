import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as complianceService from "@/modules/finance-core/service/compliance";
import { listComplianceFormsQuerySchema } from "@/modules/finance-core/schemas-compliance";

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

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listComplianceFormsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const list = await complianceService.listComplianceForms(
      ctx.dealershipId,
      query.dealId
    );
    return jsonResponse({ data: list.map(serializeForm) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
