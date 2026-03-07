import { NextRequest } from "next/server";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import * as dashboardV3 from "@/modules/dashboard/service/getDashboardV3Data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const data = await dashboardV3.getDashboardV3InventoryAlerts(
      ctx.dealershipId,
      ctx.permissions
    );
    return jsonResponse({ data });
  } catch (e) {
    return handleApiError(e);
  }
}
