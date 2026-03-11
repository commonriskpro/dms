import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { getDealerProfitReport } from "@/modules/reporting-core/service/dealer-profit";
import { dealerProfitQuerySchema } from "@/modules/reporting-core/schemas";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = dealerProfitQuerySchema.parse(
      getQueryObject(request)
    );
    const report = await getDealerProfitReport(ctx.dealershipId, {
      from: query.from,
      to: query.to,
      salespersonId: query.salespersonId ?? undefined,
    });
    return jsonResponse(report);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
