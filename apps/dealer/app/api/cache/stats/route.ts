import { NextRequest } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getCurrentUser } from "@/lib/auth";
import { getCacheStats } from "@/lib/infrastructure/cache/cacheHelpers";

/**
 * GET /api/cache/stats — in-process distributed cache stats.
 * Restricted to platform admins.
 * Returns { keysTotal, keysByPrefix, hits, misses }.
 */
export async function GET(_request: NextRequest): Promise<Response> {
  noStore();

  const user = await getCurrentUser();
  if (!user?.userId) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const isAdmin = await isPlatformAdmin(user.userId);
  if (!isAdmin) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Platform admin access required" } },
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
