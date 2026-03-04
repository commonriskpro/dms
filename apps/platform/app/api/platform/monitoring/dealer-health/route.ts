import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";

export const dynamic = "force-dynamic";

const REQUEST_ID_HEADER = "x-request-id";

/** Sanitized dealer health shape — no secrets, no env values. */
type SanitizedDealerHealth = {
  ok: boolean;
  app: string;
  version?: string;
  time: string;
  db?: string;
  upstreamStatus: number;
  error?: string;
};

/**
 * GET /api/platform/monitoring/dealer-health
 * Server-side proxy to dealer app health. No CORS; no client secrets.
 * RBAC: any authenticated platform user (Owner/Compliance/Support).
 * Returns sanitized JSON only: ok, app, version, time, db?, upstreamStatus.
 * On upstream failure: 502 with safe body (no full upstream response logged).
 */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));

  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"]);

    const baseUrl = process.env.DEALER_INTERNAL_API_URL;
    if (!baseUrl?.trim()) {
      return addRequestIdToResponse(
        jsonResponse(
          {
            ok: false,
            app: "dealer",
            time: new Date().toISOString(),
            upstreamStatus: 0,
            error: "Dealer health URL not configured",
          } satisfies SanitizedDealerHealth,
          502
        ),
        requestId
      );
    }

    const url = `${baseUrl.replace(/\/$/, "")}/api/health`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: { [REQUEST_ID_HEADER]: requestId },
        cache: "no-store",
      });
    } catch {
      return addRequestIdToResponse(
        jsonResponse(
          {
            ok: false,
            app: "dealer",
            time: new Date().toISOString(),
            upstreamStatus: 0,
            error: "Upstream unreachable",
          } satisfies SanitizedDealerHealth,
          502
        ),
        requestId
      );
    }

    const status = res.status;
    if (status !== 200) {
      return addRequestIdToResponse(
        jsonResponse(
          {
            ok: false,
            app: "dealer",
            time: new Date().toISOString(),
            upstreamStatus: status,
            error: `Upstream returned ${status}`,
          } satisfies SanitizedDealerHealth,
          502
        ),
        requestId
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return addRequestIdToResponse(
        jsonResponse(
          {
            ok: false,
            app: "dealer",
            time: new Date().toISOString(),
            upstreamStatus: status,
            error: "Invalid JSON from upstream",
          } satisfies SanitizedDealerHealth,
          502
        ),
        requestId
      );
    }

    const obj = body as Record<string, unknown>;
    const sanitized: SanitizedDealerHealth = {
      ok: typeof obj?.ok === "boolean" ? obj.ok : false,
      app: typeof obj?.app === "string" ? obj.app : "dealer",
      time: typeof obj?.time === "string" ? obj.time : new Date().toISOString(),
      upstreamStatus: status,
    };
    if (typeof obj?.version === "string") sanitized.version = obj.version;
    if (typeof obj?.db === "string") sanitized.db = obj.db;

    return addRequestIdToResponse(jsonResponse(sanitized), requestId);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
