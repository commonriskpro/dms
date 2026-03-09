import { NextRequest } from "next/server";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import * as dashboardService from "@/modules/dashboard/service/dashboard";
import { z } from "zod";

const querySchema = z.object({
  myTasksLimit: z.coerce.number().int().min(1).max(20).optional(),
  newProspectsLimit: z.coerce.number().int().min(1).max(20).optional(),
  staleLeadsDays: z.coerce.number().int().min(1).max(90).optional(),
  staleLeadsLimit: z.coerce.number().int().min(1).max(20).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "dashboard.read");
    const url = new URL(request.url);
    const query = querySchema.safeParse(Object.fromEntries(url.searchParams));
    const options = query.success ? query.data : {};
    const data = await dashboardService.getDashboard(
      ctx.dealershipId,
      ctx.userId,
      ctx.permissions,
      options
    );
    return jsonResponse({ data });
  } catch (e) {
    return handleApiError(e);
  }
}
