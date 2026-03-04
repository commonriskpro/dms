/**
 * Server-only: calls dealer internal API with signed JWT. Uses DEALER_INTERNAL_API_URL and INTERNAL_API_JWT_SECRET.
 * Every outbound request sends X-Request-Id (from options.requestId or generated) for correlation.
 */

import * as jose from "jose";
import { INTERNAL_API_AUD, INTERNAL_API_ISS } from "@dms/contracts";
import { getOrCreateRequestId } from "@/lib/request-id";

const JWT_TTL_SEC = 90;

function getBaseUrl(): string {
  const url = process.env.DEALER_INTERNAL_API_URL;
  if (!url?.startsWith("http")) {
    console.error("[platform-api] DEALER_INTERNAL_API_URL check failed", {
      hasUrl: !!url,
      urlLength: url?.length ?? 0,
      hint: !url ? "env var missing" : "url must start with http(s)",
    });
    throw new Error("DEALER_INTERNAL_API_URL not set or invalid");
  }
  return url.replace(/\/$/, "");
}

function getSecret(): Uint8Array {
  const secret = process.env.INTERNAL_API_JWT_SECRET;
  if (!secret || secret.length < 16) {
    console.error("[platform-api] INTERNAL_API_JWT_SECRET check failed", {
      hasSecret: !!secret,
      secretLength: secret?.length ?? 0,
      hint: !secret ? "env var missing" : "must be at least 16 characters",
    });
    throw new Error("INTERNAL_API_JWT_SECRET not set or too short");
  }
  return new TextEncoder().encode(secret);
}

async function createToken(jti: string): Promise<string> {
  const secret = getSecret();
  return await new jose.SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(INTERNAL_API_AUD)
    .setIssuer(INTERNAL_API_ISS)
    .setJti(jti)
    .setExpirationTime(`${JWT_TTL_SEC}s`)
    .sign(secret);
}

export type DealerProvisionResult = { dealerDealershipId: string; provisionedAt: string };
export type DealerProvisionError = { status: number; code: string; message: string };

const REQUEST_ID_HEADER = "x-request-id";

export async function callDealerProvision(
  platformDealershipId: string,
  legalName: string,
  displayName: string,
  planKey: string,
  limits: Record<string, unknown>,
  idempotencyKey: string,
  options?: { jti?: string; requestId?: string }
): Promise<
  | { ok: true; data: DealerProvisionResult; jti: string }
  | { ok: false; error: DealerProvisionError; jti: string }
> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti =
    options?.jti ?? `provision-${platformDealershipId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Idempotency-Key": idempotencyKey,
    [REQUEST_ID_HEADER]: requestId,
  };
  const res = await fetch(`${base}/api/internal/provision/dealership`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      platformDealershipId,
      legalName,
      displayName,
      planKey,
      limits,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        code: (json.error as { code?: string })?.code ?? "UNKNOWN",
        message: (json.error as { message?: string })?.message ?? res.statusText,
      },
      jti,
    };
  }
  return {
    ok: true,
    data: {
      dealerDealershipId: (json as { dealerDealershipId: string }).dealerDealershipId,
      provisionedAt: (json as { provisionedAt: string }).provisionedAt,
    },
    jti,
  };
}

export async function callDealerStatus(
  dealerDealershipId: string,
  status: "ACTIVE" | "SUSPENDED" | "CLOSED",
  options: { reason?: string; platformActorId?: string; requestId?: string } = {}
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti = `status-${dealerDealershipId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    [REQUEST_ID_HEADER]: requestId,
  };
  const res = await fetch(`${base}/api/internal/dealerships/${dealerDealershipId}/status`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      status,
      reason: options.reason ?? undefined,
      platformActorId: options.platformActorId ?? undefined,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: (json.error as { message?: string })?.message ?? res.statusText,
    };
  }
  return { ok: true };
}

export type DealerOwnerInviteResult = {
  inviteId: string;
  invitedEmail: string;
  createdAt: string;
  acceptUrl?: string;
};
export type DealerOwnerInviteStatusResult = {
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  expiresAt?: string | null;
  acceptedAt?: string | null;
};
export type DealerOwnerInviteError = { status: number; code: string; message: string };

export async function callDealerOwnerInviteStatus(
  dealerDealershipId: string,
  email: string,
  options?: { requestId?: string }
): Promise<
  | { ok: true; data: DealerOwnerInviteStatusResult }
  | { ok: false; error: DealerOwnerInviteError }
> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti = `owner-invite-status-${dealerDealershipId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const url = new URL(`${base}/api/internal/dealerships/${dealerDealershipId}/owner-invite-status`);
  url.searchParams.set("email", encodeURIComponent(email));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    [REQUEST_ID_HEADER]: requestId,
  };
  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[platform-api] callDealerOwnerInviteStatus fetch failed", {
      dealerDealershipId,
      errorMessage: msg,
    });
    throw e;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        code: (json.error as { code?: string })?.code ?? "UNKNOWN",
        message: (json.error as { message?: string })?.message ?? res.statusText,
      },
    };
  }
  const data = json as DealerOwnerInviteStatusResult;
  return {
    ok: true,
    data: {
      status: data.status ?? "PENDING",
      expiresAt: data.expiresAt ?? null,
      acceptedAt: data.acceptedAt ?? null,
    },
  };
}

export async function callDealerOwnerInvite(
  dealerDealershipId: string,
  email: string,
  platformDealershipId: string,
  platformActorId: string,
  idempotencyKey: string,
  options?: { requestId?: string }
): Promise<
  | { ok: true; data: DealerOwnerInviteResult }
  | { ok: false; error: DealerOwnerInviteError }
> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti = `owner-invite-${dealerDealershipId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "Idempotency-Key": idempotencyKey,
    [REQUEST_ID_HEADER]: requestId,
  };
  const res = await fetch(`${base}/api/internal/dealerships/${dealerDealershipId}/owner-invite`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      platformDealershipId,
      platformActorId,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        code: (json.error as { code?: string })?.code ?? "UNKNOWN",
        message: (json.error as { message?: string })?.message ?? res.statusText,
      },
    };
  }
  return {
    ok: true,
    data: {
      inviteId: (json as { inviteId: string }).inviteId,
      invitedEmail: (json as { invitedEmail: string }).invitedEmail,
      createdAt: (json as { createdAt: string }).createdAt,
      acceptUrl: (json as { acceptUrl?: string }).acceptUrl,
    },
  };
}

export type DealerJobRunsResult = { data: unknown[]; total: number };
export type DealerJobRunsError = { status: number; message: string };

export async function callDealerJobRuns(
  dealerDealershipId: string,
  params: { dateFrom: string; dateTo: string; limit: number; offset: number },
  options?: { requestId?: string }
): Promise<{ ok: true; data: DealerJobRunsResult } | { ok: false; error: DealerJobRunsError }> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti = `job-runs-${dealerDealershipId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const url = new URL(`${base}/api/internal/monitoring/job-runs`);
  url.searchParams.set("dealershipId", dealerDealershipId);
  url.searchParams.set("dateFrom", params.dateFrom);
  url.searchParams.set("dateTo", params.dateTo);
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    [REQUEST_ID_HEADER]: requestId,
  };
  const res = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        message: (json.error as { message?: string })?.message ?? res.statusText,
      },
    };
  }
  const data = json as { data?: unknown[]; total?: number };
  return {
    ok: true,
    data: {
      data: Array.isArray(data.data) ? data.data : [],
      total: typeof data.total === "number" ? data.total : 0,
    },
  };
}

export type DealerRateLimitsQuery = {
  dateFrom: string;
  dateTo: string;
  routeKey?: string;
  limit: number;
  offset: number;
};

export type DealerRateLimitsResult = {
  items: Array<{ routeKey: string; windowStart: string; allowedCount: number; blockedCount: number }>;
  limit: number;
  offset: number;
};
export type DealerRateLimitsError = { status: number; message: string };

export async function callDealerRateLimits(
  params: DealerRateLimitsQuery,
  options?: { requestId?: string }
): Promise<
  | { ok: true; data: DealerRateLimitsResult }
  | { ok: false; error: DealerRateLimitsError }
> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti = `rate-limits-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const url = new URL(`${base}/api/internal/monitoring/rate-limits`);
  url.searchParams.set("dateFrom", params.dateFrom);
  url.searchParams.set("dateTo", params.dateTo);
  if (params.routeKey !== undefined && params.routeKey !== "") {
    url.searchParams.set("routeKey", params.routeKey);
  }
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    [REQUEST_ID_HEADER]: requestId,
  };
  const res = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        message: (json.error as { message?: string })?.message ?? res.statusText,
      },
    };
  }
  const data = json as { items?: unknown[]; limit?: number; offset?: number };
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    ok: true,
    data: {
      items: items.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          routeKey: typeof r.routeKey === "string" ? r.routeKey : "",
          windowStart: typeof r.windowStart === "string" ? r.windowStart : "",
          allowedCount: typeof r.allowedCount === "number" ? r.allowedCount : 0,
          blockedCount: typeof r.blockedCount === "number" ? r.blockedCount : 0,
        };
      }),
      limit: typeof data.limit === "number" ? data.limit : params.limit,
      offset: typeof data.offset === "number" ? data.offset : params.offset,
    },
  };
}

export type DealerRateLimitsDailyQuery = {
  dateFrom: string;
  dateTo: string;
  limit: number;
  offset: number;
};

export type DealerRateLimitsDailyResult = {
  items: Array<{
    day: string;
    routeKey: string;
    allowedCount: number;
    blockedCount: number;
    uniqueIpCountApprox: number | null;
  }>;
  total: number;
  limit: number;
  offset: number;
};

export async function callDealerRateLimitsDaily(
  params: DealerRateLimitsDailyQuery,
  options?: { requestId?: string }
): Promise<
  | { ok: true; data: DealerRateLimitsDailyResult }
  | { ok: false; error: DealerRateLimitsError }
> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti = `rate-limits-daily-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const url = new URL(`${base}/api/internal/monitoring/rate-limits/daily`);
  url.searchParams.set("dateFrom", params.dateFrom);
  url.searchParams.set("dateTo", params.dateTo);
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    [REQUEST_ID_HEADER]: requestId,
  };
  const res = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        message: (json.error as { message?: string })?.message ?? res.statusText,
      },
    };
  }
  const data = json as {
    items?: unknown[];
    total?: number;
    limit?: number;
    offset?: number;
  };
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    ok: true,
    data: {
      items: items.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          day: typeof r.day === "string" ? r.day : "",
          routeKey: typeof r.routeKey === "string" ? r.routeKey : "",
          allowedCount: typeof r.allowedCount === "number" ? r.allowedCount : 0,
          blockedCount: typeof r.blockedCount === "number" ? r.blockedCount : 0,
          uniqueIpCountApprox:
            typeof r.uniqueIpCountApprox === "number" ? r.uniqueIpCountApprox : null,
        };
      }),
      total: typeof data.total === "number" ? data.total : 0,
      limit: typeof data.limit === "number" ? data.limit : params.limit,
      offset: typeof data.offset === "number" ? data.offset : params.offset,
    },
  };
}

export type DealerJobRunsDailyQuery = {
  dateFrom: string;
  dateTo: string;
  dealershipId?: string;
  limit: number;
  offset: number;
};

export type DealerJobRunsDailyResult = {
  items: Array<{
    day: string;
    dealershipId: string;
    totalRuns: number;
    skippedRuns: number;
    processedRuns: number;
    failedRuns: number;
    avgDurationMs: number;
  }>;
  total: number;
  limit: number;
  offset: number;
};

export async function callDealerJobRunsDaily(
  params: DealerJobRunsDailyQuery,
  options?: { requestId?: string }
): Promise<{ ok: true; data: DealerJobRunsDailyResult } | { ok: false; error: DealerJobRunsError }> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti = `job-runs-daily-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const url = new URL(`${base}/api/internal/monitoring/job-runs/daily`);
  url.searchParams.set("dateFrom", params.dateFrom);
  url.searchParams.set("dateTo", params.dateTo);
  if (params.dealershipId != null && params.dealershipId !== "") {
    url.searchParams.set("dealershipId", params.dealershipId);
  }
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("offset", String(params.offset));
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    [REQUEST_ID_HEADER]: requestId,
  };
  const res = await fetch(url.toString(), { method: "GET", headers, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        message: (json.error as { message?: string })?.message ?? res.statusText,
      },
    };
  }
  const data = json as {
    items?: unknown[];
    total?: number;
    limit?: number;
    offset?: number;
  };
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    ok: true,
    data: {
      items: items.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          day: typeof r.day === "string" ? r.day : "",
          dealershipId: typeof r.dealershipId === "string" ? r.dealershipId : "",
          totalRuns: typeof r.totalRuns === "number" ? r.totalRuns : 0,
          skippedRuns: typeof r.skippedRuns === "number" ? r.skippedRuns : 0,
          processedRuns: typeof r.processedRuns === "number" ? r.processedRuns : 0,
          failedRuns: typeof r.failedRuns === "number" ? r.failedRuns : 0,
          avgDurationMs: typeof r.avgDurationMs === "number" ? r.avgDurationMs : 0,
        };
      }),
      total: typeof data.total === "number" ? data.total : 0,
      limit: typeof data.limit === "number" ? data.limit : params.limit,
      offset: typeof data.offset === "number" ? data.offset : params.offset,
    },
  };
}

export type DealerMaintenanceRunRequest = {
  kind: "purge" | "aggregate" | "all";
  date?: string;
};

export async function callDealerMonitoringMaintenanceRun(
  body: DealerMaintenanceRunRequest,
  options?: { requestId?: string }
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: DealerRateLimitsError }> {
  const base = getBaseUrl();
  const requestId = getOrCreateRequestId(options?.requestId ?? null);
  const jti = `maintenance-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const token = await createToken(jti);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    [REQUEST_ID_HEADER]: requestId,
  };
  const res = await fetch(`${base}/api/internal/monitoring/maintenance/run`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: {
        status: res.status,
        message: (json.error as { message?: string })?.message ?? res.statusText,
      },
    };
  }
  return { ok: true, data: (json as Record<string, unknown>) ?? {} };
}
