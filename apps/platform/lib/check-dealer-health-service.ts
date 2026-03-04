/**
 * Check dealer health, update alert state, and send Slack/email when threshold met.
 * State machine: fail -> alert once (3 consecutive or 5 min) -> cooldown 15 min -> recover -> recovery alert once.
 */

import { platformAlertEventSchema, type PlatformAlertEvent } from "@dms/contracts";
import {
  createMonitoringEvent,
  getOrCreateDealerHealthAlertState,
  upsertDealerHealthAlertState,
} from "./monitoring-db";
import type { PlatformGetDealerHealthResponse } from "@dms/contracts";

const REQUEST_ID_HEADER = "x-request-id";
const CONSECUTIVE_FAIL_THRESHOLD = 3;
const FIRST_FAIL_ALERT_AFTER_MS = 5 * 60 * 1000; // 5 min since first fail
const COOLDOWN_MS = 15 * 60 * 1000; // 15 min between alerts for same condition

export type CheckDealerHealthOptions = {
  requestId: string;
  /** Base URL for dealer API (e.g. DEALER_INTERNAL_API_URL). */
  dealerBaseUrl: string;
  /** Platform public URL for alert payload (optional). */
  platformBaseUrl?: string;
  /** Optional platform dealership id (null for global dealer health). */
  platformDealershipId?: string | null;
  /** Override fetch for tests. */
  fetchFn?: typeof fetch;
};

export type CheckDealerHealthResult = {
  ok: boolean;
  upstreamStatus: number;
  eventCreated: "DEALER_HEALTH_FAIL" | "DEALER_HEALTH_RECOVER" | null;
  alertSent: boolean;
};

/**
 * Fetch dealer health from dealer app (DEALER_INTERNAL_API_URL/api/health).
 * Returns sanitized shape; ok false and upstreamStatus 0 on network error.
 */
export async function fetchDealerHealth(
  dealerBaseUrl: string,
  requestId: string,
  fetchFn: typeof fetch = fetch
): Promise<PlatformGetDealerHealthResponse> {
  const url = `${dealerBaseUrl.replace(/\/$/, "")}/api/health`;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "GET",
      headers: { [REQUEST_ID_HEADER]: requestId },
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      app: "dealer",
      time: new Date().toISOString(),
      upstreamStatus: 0,
      error: "Upstream unreachable",
    };
  }

  const status = res.status;
  if (status !== 200) {
    return {
      ok: false,
      app: "dealer",
      time: new Date().toISOString(),
      upstreamStatus: status,
      error: `Upstream returned ${status}`,
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return {
      ok: false,
      app: "dealer",
      time: new Date().toISOString(),
      upstreamStatus: status,
      error: "Invalid JSON from upstream",
    };
  }

  const obj = body as Record<string, unknown>;
  return {
    ok: typeof obj?.ok === "boolean" ? obj.ok : false,
    app: typeof obj?.app === "string" ? obj.app : "dealer",
    time: typeof obj?.time === "string" ? obj.time : new Date().toISOString(),
    upstreamStatus: status,
    version: typeof obj?.version === "string" ? obj.version : undefined,
    db: typeof obj?.db === "string" ? obj.db : undefined,
    error: typeof obj?.error === "string" ? obj.error : undefined,
  };
}

function buildAlertPayload(params: {
  status: "outage" | "recovered";
  upstreamStatus: number;
  platformBaseUrl?: string;
  dealerBaseUrl: string;
  requestId: string;
}): PlatformAlertEvent {
  const payload: PlatformAlertEvent = {
    status: params.status,
    upstreamStatus: params.upstreamStatus,
    platformUrl: params.platformBaseUrl || undefined,
    dealerUrl: params.dealerBaseUrl || undefined,
    requestId: params.requestId,
    timestamp: new Date().toISOString(),
  };
  return platformAlertEventSchema.parse(payload);
}

async function sendSlack(payload: PlatformAlertEvent, fetchFn: typeof fetch): Promise<void> {
  const url = process.env.PLATFORM_SLACK_WEBHOOK_URL;
  if (!url?.trim()) return;
  await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function sendEmailIfConfigured(
  payload: PlatformAlertEvent,
  fetchFn: typeof fetch
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PLATFORM_EMAIL_FROM;
  const to = process.env.PLATFORM_SUPPORT_EMAIL;
  if (!apiKey?.trim() || !from?.trim() || !to?.trim()) return;

  const subject =
    payload.status === "recovered"
      ? "[DMS Platform] Dealer health recovered"
      : "[DMS Platform] Dealer health failure";

  const text = [
    `Status: ${payload.status}`,
    `Upstream status: ${payload.upstreamStatus ?? "n/a"}`,
    `Platform URL: ${payload.platformUrl ?? "n/a"}`,
    `Dealer URL: ${payload.dealerUrl ?? "n/a"}`,
    `Request ID: ${payload.requestId ?? "n/a"}`,
    `Timestamp: ${payload.timestamp}`,
  ].join("\n");

  await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: from.trim(),
      to: [to.trim()],
      subject,
      text,
    }),
  });
}

/**
 * Run check: fetch health, update state, insert events, send alerts when threshold + cooldown allow.
 */
export async function checkDealerHealth(options: CheckDealerHealthOptions): Promise<CheckDealerHealthResult> {
  const {
    requestId,
    dealerBaseUrl,
    platformBaseUrl,
    platformDealershipId = null,
    fetchFn = fetch,
  } = options;

  const health = await fetchDealerHealth(dealerBaseUrl, requestId, fetchFn);
  const now = new Date();
  const state = await getOrCreateDealerHealthAlertState(now);

  let eventCreated: "DEALER_HEALTH_FAIL" | "DEALER_HEALTH_RECOVER" | null = null;
  let alertSent = false;

  if (health.ok) {
    if (state.lastStatus === "FAIL") {
      await createMonitoringEvent({
        type: "DEALER_HEALTH_RECOVER",
        platformDealershipId,
        dealerBaseUrl,
        upstreamStatus: health.upstreamStatus,
        requestId,
      });
      eventCreated = "DEALER_HEALTH_RECOVER";
      await upsertDealerHealthAlertState({
        lastStatus: "OK",
        lastChangeAt: now,
        consecutiveFails: 0,
        lastAlertSentAt: undefined,
      });

      const payload = buildAlertPayload({
        status: "recovered",
        upstreamStatus: health.upstreamStatus,
        platformBaseUrl,
        dealerBaseUrl,
        requestId,
      });
      await sendSlack(payload, fetchFn);
      await sendEmailIfConfigured(payload, fetchFn);
      alertSent = true;
    } else {
      await upsertDealerHealthAlertState({
        lastStatus: "OK",
        lastChangeAt: now,
        consecutiveFails: 0,
        lastAlertSentAt: undefined,
      });
    }
    return { ok: true, upstreamStatus: health.upstreamStatus, eventCreated, alertSent };
  }

  // Health failed
  await createMonitoringEvent({
    type: "DEALER_HEALTH_FAIL",
    platformDealershipId,
    dealerBaseUrl,
    upstreamStatus: health.upstreamStatus,
    requestId,
  });
  eventCreated = "DEALER_HEALTH_FAIL";

  const consecutiveFails = state.lastStatus === "FAIL" ? state.consecutiveFails + 1 : 1;
  const firstFailAt = state.lastStatus === "FAIL" ? state.lastChangeAt : now;

  const thresholdMet =
    consecutiveFails >= CONSECUTIVE_FAIL_THRESHOLD ||
    now.getTime() - firstFailAt.getTime() >= FIRST_FAIL_ALERT_AFTER_MS;

  const lastAlert = state.lastAlertSentAt ?? new Date(0);
  const cooldownPassed = now.getTime() - lastAlert.getTime() >= COOLDOWN_MS;

  if (thresholdMet && cooldownPassed) {
    const payload = buildAlertPayload({
      status: "outage",
      upstreamStatus: health.upstreamStatus,
      platformBaseUrl,
      dealerBaseUrl,
      requestId,
    });
    await sendSlack(payload, fetchFn);
    await sendEmailIfConfigured(payload, fetchFn);
    alertSent = true;
    await upsertDealerHealthAlertState({
      lastStatus: "FAIL",
      lastChangeAt: state.lastStatus === "FAIL" ? state.lastChangeAt : now,
      consecutiveFails,
      lastAlertSentAt: now,
    });
  } else {
    await upsertDealerHealthAlertState({
      lastStatus: "FAIL",
      lastChangeAt: state.lastStatus === "FAIL" ? state.lastChangeAt : now,
      consecutiveFails,
      lastAlertSentAt: undefined,
    });
  }

  return {
    ok: false,
    upstreamStatus: health.upstreamStatus,
    eventCreated,
    alertSent,
  };
}
