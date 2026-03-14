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

function parseRange(query: Record<string, unknown>): { from: Date; to: Date; limit: number } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  let limit = 10;

  if (typeof query.from === "string") {
    const f = new Date(query.from);
    if (!Number.isNaN(f.getTime())) from.setTime(f.getTime());
  }
  if (typeof query.to === "string") {
    const t = new Date(query.to);
    if (!Number.isNaN(t.getTime())) to.setTime(t.getTime());
  }
  if (typeof query.limit === "string") {
    const n = parseInt(query.limit, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 50) limit = n;
  }
  return { from, to, limit };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.read");
    const query = getQueryObject(request);
    const { from, to, limit } = parseRange(query);

    const data = await analyticsRead.getTopPages(ctx.dealershipId, from, to, limit);
    return jsonResponse({ data, from: from.toISOString(), to: to.toISOString() });
  } catch (e) {
    return handleApiError(e);
  }
}
