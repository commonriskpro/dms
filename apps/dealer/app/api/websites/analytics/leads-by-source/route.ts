import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { getQueryObject } from "@/lib/api/query";
import * as analyticsRead from "@/modules/websites-public/analytics-read";

export const dynamic = "force-dynamic";

function parseDateRange(query: Record<string, unknown>): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);

  if (typeof query.from === "string") {
    const f = new Date(query.from);
    if (!Number.isNaN(f.getTime())) from.setTime(f.getTime());
  }
  if (typeof query.to === "string") {
    const t = new Date(query.to);
    if (!Number.isNaN(t.getTime())) to.setTime(t.getTime());
  }
  return { from, to };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.read");
    const query = getQueryObject(request);
    const { from, to } = parseDateRange(query);

    const data = await analyticsRead.getLeadsBySource(ctx.dealershipId, from, to);
    return jsonResponse({ data, from: from.toISOString(), to: to.toISOString() });
  } catch (e) {
    return handleApiError(e);
  }
}
