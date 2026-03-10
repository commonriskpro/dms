/**
 * Platform monitoring DB layer. No tenant (platform-level only).
 * All access to platform_monitoring_events and platform_alert_state.
 */

import { prisma } from "./db";
import type { PlatformMonitoringEventType, PlatformAlertStatus } from "../../node_modules/.prisma/platform-client";

const ALERT_STATE_KEY_DEALER_HEALTH = "dealer_health";

export type CreateMonitoringEventParams = {
  type: PlatformMonitoringEventType;
  platformDealershipId: string | null;
  dealerBaseUrl: string;
  upstreamStatus: number;
  requestId: string;
};

export type AlertStateRow = {
  id: string;
  key: string;
  lastStatus: PlatformAlertStatus;
  lastChangeAt: Date;
  consecutiveFails: number;
  lastAlertSentAt: Date | null;
};

/** Insert a monitoring event (append-only). */
export async function createMonitoringEvent(params: CreateMonitoringEventParams): Promise<string> {
  const row = await prisma.platformMonitoringEvent.create({
    data: {
      type: params.type,
      platformDealershipId: params.platformDealershipId,
      dealerBaseUrl: params.dealerBaseUrl.slice(0, 2048),
      upstreamStatus: params.upstreamStatus,
      requestId: params.requestId.slice(0, 255),
    },
    select: { id: true },
  });
  return row.id;
}

/** Get or create dealer-health alert state. Creates with OK if missing. */
export async function getOrCreateDealerHealthAlertState(now: Date): Promise<AlertStateRow> {
  const key = ALERT_STATE_KEY_DEALER_HEALTH;
  let row = await prisma.platformAlertState.findUnique({ where: { key } });
  if (!row) {
    row = await prisma.platformAlertState.create({
      data: {
        key,
        lastStatus: "OK",
        lastChangeAt: now,
        consecutiveFails: 0,
      },
    });
  }
  return row;
}

/** Upsert dealer-health alert state (status, consecutiveFails, optional lastAlertSentAt). */
export async function upsertDealerHealthAlertState(params: {
  lastStatus: PlatformAlertStatus;
  lastChangeAt: Date;
  consecutiveFails: number;
  lastAlertSentAt?: Date | null;
}): Promise<AlertStateRow> {
  const key = ALERT_STATE_KEY_DEALER_HEALTH;
  const row = await prisma.platformAlertState.upsert({
    where: { key },
    create: {
      key,
      lastStatus: params.lastStatus,
      lastChangeAt: params.lastChangeAt,
      consecutiveFails: params.consecutiveFails,
      lastAlertSentAt: params.lastAlertSentAt ?? null,
    },
    update: {
      lastStatus: params.lastStatus,
      lastChangeAt: params.lastChangeAt,
      consecutiveFails: params.consecutiveFails,
      ...(params.lastAlertSentAt !== undefined && { lastAlertSentAt: params.lastAlertSentAt }),
    },
  });
  return row;
}
