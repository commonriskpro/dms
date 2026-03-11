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
import { listComplianceAlertsQuerySchema } from "@/modules/finance-core/schemas-compliance";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listComplianceAlertsQuerySchema.parse(
      getQueryObject(request)
    );
    const alerts = await complianceService.getComplianceAlerts(ctx.dealershipId, {
      dealId: query.dealId,
    });
    return jsonResponse({ data: alerts });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
