/**
 * POST /api/platform/monitoring/check-dealer-health
 *
 * Runs dealer health check, updates alert state, inserts monitoring events,
 * and sends Slack (and optional email) when threshold met or on recovery.
 *
 * Auth: CRON_SECRET header (value match) for server-to-server, OR platform OWNER role.
 * Prefer CRON_SECRET when header present.
 */

import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { getOrCreateRequestId } from "@/lib/request-id";
import { checkDealerHealth } from "@/lib/check-dealer-health-service";

export const dynamic = "force-dynamic";

const CRON_SECRET_HEADER = "x-cron-secret";

async function isAuthorizedCron(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) return false;
  const header = request.headers.get(CRON_SECRET_HEADER);
  return header != null && header.trim() === secret.trim();
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get("x-request-id") ?? null);

  try {
    const cronOk = await isAuthorizedCron(request);
    if (!cronOk) {
      const user = await requirePlatformAuth();
      await requirePlatformRole(user, ["PLATFORM_OWNER"]);
    }

    const dealerBaseUrl = process.env.DEALER_INTERNAL_API_URL?.trim();
    if (!dealerBaseUrl) {
      return jsonResponse(
        {
          error: {
            code: "CONFIG_ERROR",
            message: "DEALER_INTERNAL_API_URL not configured",
          },
        },
        503
      );
    }

    const platformBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ??
      (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL}` : undefined);

    const result = await checkDealerHealth({
      requestId,
      dealerBaseUrl,
      platformBaseUrl,
      platformDealershipId: null,
    });

    return jsonResponse({
      ok: result.ok,
      upstreamStatus: result.upstreamStatus,
      eventCreated: result.eventCreated,
      alertSent: result.alertSent,
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
