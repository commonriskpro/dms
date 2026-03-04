import { NextRequest } from "next/server";
import { z } from "zod";
import { getJourneyBarData } from "@/modules/crm-pipeline-automation/service/journey-bar";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { journeyBarQuerySchema } from "../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthContext(req);
    await guardPermission(ctx, "crm.read");
    const query = journeyBarQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const input =
      query.customerId != null
        ? { customerId: query.customerId }
        : { opportunityId: query.opportunityId! };
    const data = await getJourneyBarData(ctx.dealershipId, input);
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
