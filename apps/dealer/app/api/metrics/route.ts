import { NextRequest } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getCurrentUser } from "@/lib/auth";
import { getMetricsOutput, getMetricsContentType } from "@/lib/infrastructure/metrics/prometheus";

/**
 * GET /api/metrics — Prometheus metrics endpoint.
 * Restricted to platform admins (or METRICS_SECRET bearer token).
 * Non-blocking: returns empty 200 if metrics unavailable.
 */
export async function GET(request: NextRequest): Promise<Response> {
  noStore();

  // Allow secret-based access for scraping agents (e.g. Prometheus server)
  const secret = process.env.METRICS_SECRET;
  if (secret) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader === `Bearer ${secret}`) {
      return await serveMetrics();
    }
  }

  // Fallback: platform admin check via session
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

  return await serveMetrics();
}

async function serveMetrics(): Promise<Response> {
  try {
    const [output, contentType] = await Promise.all([
      getMetricsOutput(),
      Promise.resolve(getMetricsContentType()),
    ]);
    return new Response(output, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Non-blocking: never crash the server for metrics
    return new Response("# metrics unavailable\n", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
