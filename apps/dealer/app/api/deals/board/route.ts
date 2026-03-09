import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { getDealBoard } from "@/modules/deals/service/board";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const data = await getDealBoard(ctx.dealershipId);
    return jsonResponse({ data });
  } catch (e) {
    return handleApiError(e);
  }
}
