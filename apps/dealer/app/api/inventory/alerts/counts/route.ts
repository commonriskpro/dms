import { NextRequest } from "next/server";
import * as alertsService from "@/modules/inventory/service/alerts";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const exclude = request.nextUrl.searchParams.get("excludeDismissedForUser");
    const excludeDismissedForUser = exclude !== "false";
    const counts = await alertsService.getAlertCounts(
      ctx.dealershipId,
      ctx.userId,
      excludeDismissedForUser
    );
    return jsonResponse({ data: counts });
  } catch (e) {
    return handleApiError(e);
  }
}
