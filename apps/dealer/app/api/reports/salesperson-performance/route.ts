import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { getSalespersonPerformance } from "@/modules/reporting-core/service/salesperson-performance";
import { salespersonPerformanceQuerySchema } from "@/modules/reporting-core/schemas";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = salespersonPerformanceQuerySchema.parse(
      getQueryObject(request)
    );
    const report = await getSalespersonPerformance(ctx.dealershipId, {
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse(report);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
