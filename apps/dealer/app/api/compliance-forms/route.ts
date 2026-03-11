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
import { serializeComplianceForm } from "@/modules/finance-core/serialize";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listComplianceFormsQuerySchema.parse(
      getQueryObject(request)
    );
    const list = await complianceService.listComplianceForms(
      ctx.dealershipId,
      query.dealId
    );
    return jsonResponse({ data: list.map(serializeComplianceForm) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
