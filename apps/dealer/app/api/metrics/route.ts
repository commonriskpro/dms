import { NextRequest } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getMetricsOutput, getMetricsContentType } from "@/lib/infrastructure/metrics/prometheus";
import { hasDealerOperatorAccess } from "@/lib/operator-access";

/**
 * GET /api/metrics — Prometheus metrics endpoint.
 * Restricted to support-session operators or METRICS_SECRET bearer token.
 * Non-blocking: returns empty 200 if metrics unavailable.
 */
export async function GET(request: NextRequest): Promise<Response> {
  noStore();

  if (!(await hasDealerOperatorAccess(request))) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Operator access required" } },
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
