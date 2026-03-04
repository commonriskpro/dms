import { NextRequest } from "next/server";
import {
  platformMonitoringMaintenanceRequestSchema,
  type PlatformMonitoringMaintenanceRequest,
} from "@dms/contracts";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { REQUEST_ID_HEADER, addRequestIdToResponse, getOrCreateRequestId } from "@/lib/request-id";
import { callDealerMonitoringMaintenanceRun } from "@/lib/call-dealer-internal";
import {
  getPlatformAuditLogsRetentionDays,
  getPlatformMonitoringEventsRetentionDays,
} from "@/lib/env";
import { purgeOldMonitoringEvents } from "@/lib/monitoring-retention";

export const dynamic = "force-dynamic";

const CRON_SECRET_HEADER = "x-cron-secret";

function hasValidCronSecret(request: NextRequest): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) return false;
  const provided = request.headers.get(CRON_SECRET_HEADER)?.trim();
  return provided != null && provided === configured;
}

/**
 * POST /api/platform/monitoring/maintenance/run
 * Auth: x-cron-secret OR PLATFORM_OWNER.
 * Runs platform telemetry purge and delegates to dealer maintenance endpoint.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
  try {
    if (!hasValidCronSecret(request)) {
      const user = await requirePlatformAuth();
      await requirePlatformRole(user, ["PLATFORM_OWNER"]);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return addRequestIdToResponse(
        errorResponse("VALIDATION_ERROR", "Invalid JSON body", 422),
        requestId
      );
    }

    const parsed = platformMonitoringMaintenanceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return addRequestIdToResponse(
        errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten()),
        requestId
      );
    }

    const payload: {
      ok: true;
      requestId: string;
      platform: {
        retentionDaysMonitoringEvents: number;
        retentionDaysAuditLogs: number;
        purgedMonitoringEvents?: number;
      };
      dealer: Record<string, unknown>;
    } = {
      ok: true,
      requestId,
      platform: {
        retentionDaysMonitoringEvents: getPlatformMonitoringEventsRetentionDays(),
        retentionDaysAuditLogs: getPlatformAuditLogsRetentionDays(),
      },
      dealer: {},
    };

    const command: PlatformMonitoringMaintenanceRequest = parsed.data;
    if (command.kind === "purge" || command.kind === "all") {
      const purged = await purgeOldMonitoringEvents({
        olderThanDays: getPlatformMonitoringEventsRetentionDays(),
      });
      payload.platform.purgedMonitoringEvents = purged.deletedCount;
    }

    const dealer = await callDealerMonitoringMaintenanceRun(command, { requestId });
    if (!dealer.ok) {
      const status = dealer.error.status >= 500 ? 502 : dealer.error.status;
      return addRequestIdToResponse(
        jsonResponse(
          {
            error: {
              code: "UPSTREAM_ERROR",
              message: "Dealer maintenance endpoint unavailable",
              details: {
                requestId,
                upstreamStatus: dealer.error.status,
              },
            },
          },
          status
        ),
        requestId
      );
    }
    payload.dealer = dealer.data;

    return addRequestIdToResponse(jsonResponse(payload), requestId);
  } catch (e) {
    return addRequestIdToResponse(handlePlatformApiError(e), requestId);
  }
}
