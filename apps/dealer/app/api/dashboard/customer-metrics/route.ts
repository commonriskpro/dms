import { NextRequest } from "next/server";
import * as customerService from "@/modules/customers/service/customer";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const metrics = await customerService.getCustomerMetrics(ctx.dealershipId);
    return jsonResponse({ data: metrics });
  } catch (e) {
    return handleApiError(e);
  }
}
