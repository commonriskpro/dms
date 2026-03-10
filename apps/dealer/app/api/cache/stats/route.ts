import { NextRequest } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getCacheStats } from "@/lib/infrastructure/cache/cacheHelpers";
import { hasDealerOperatorAccess } from "@/lib/operator-access";

/**
 * GET /api/cache/stats — in-process distributed cache stats.
 * Restricted to support-session operators or METRICS_SECRET bearer token.
 * Returns { keysTotal, keysByPrefix, hits, misses }.
 */
export async function GET(request: NextRequest): Promise<Response> {
  noStore();

  if (!(await hasDealerOperatorAccess(request))) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Operator access required" } },
      { status: 403 }
    );
  }

  try {
    const stats = getCacheStats();
    return Response.json(stats, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[cache/stats] failed to collect stats:", err);
    return Response.json(
      { error: { code: "INTERNAL", message: "Failed to collect cache stats" } },
      { status: 500 }
    );
  }
}
