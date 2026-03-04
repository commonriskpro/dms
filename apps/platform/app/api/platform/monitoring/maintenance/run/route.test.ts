import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
const purgeOldMonitoringEventsMock = vi.hoisted(() => vi.fn());
const callDealerMonitoringMaintenanceRunMock = vi.hoisted(() => vi.fn());
const PlatformApiErrorClass = vi.hoisted(() => {
  class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  }
  return PlatformApiError;
});

vi.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: requirePlatformAuthMock,
  requirePlatformRole: requirePlatformRoleMock,
  PlatformApiError: PlatformApiErrorClass,
}));

vi.mock("@/lib/monitoring-retention", () => ({
  purgeOldMonitoringEvents: purgeOldMonitoringEventsMock,
}));

vi.mock("@/lib/call-dealer-internal", () => ({
  callDealerMonitoringMaintenanceRun: callDealerMonitoringMaintenanceRunMock,
}));

describe("POST /api/platform/monitoring/maintenance/run", () => {
  const prevEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    prevEnv.CRON_SECRET = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-secret";

    purgeOldMonitoringEventsMock.mockResolvedValue({
      deletedCount: 11,
      cutoffIso: "2026-03-01T00:00:00.000Z",
      touchedTables: ["platform_monitoring_events"],
    });
    callDealerMonitoringMaintenanceRunMock.mockResolvedValue({
      ok: true,
      data: { ok: true, requestId: "dealer-req", purged: { rateLimitEventsDeleted: 3 } },
    });
  });

  afterEach(() => {
    if (prevEnv.CRON_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevEnv.CRON_SECRET;
    vi.restoreAllMocks();
  });

  it("returns 401 without cron and without auth", async () => {
    requirePlatformAuthMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("UNAUTHORIZED", "Not authenticated", 401)
    );
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/platform/monitoring/maintenance/run", {
        method: "POST",
        body: JSON.stringify({ kind: "all" }),
      })
    );
    expect(res.status).toBe(401);
    expect(callDealerMonitoringMaintenanceRunMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-owner without valid cron header", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Insufficient role", 403)
    );
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/platform/monitoring/maintenance/run", {
        method: "POST",
        headers: { "x-cron-secret": "wrong" },
        body: JSON.stringify({ kind: "all" }),
      })
    );
    expect(res.status).toBe(403);
    expect(callDealerMonitoringMaintenanceRunMock).not.toHaveBeenCalled();
  });

  it("accepts cron-secret and returns sanitized payload", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/platform/monitoring/maintenance/run", {
        method: "POST",
        headers: { "x-cron-secret": "cron-secret", "x-request-id": "req-1" },
        body: JSON.stringify({ kind: "all", date: "2026-03-01" }),
      })
    );
    expect(res.status).toBe(200);
    expect(requirePlatformAuthMock).not.toHaveBeenCalled();
    expect(callDealerMonitoringMaintenanceRunMock).toHaveBeenCalledWith(
      { kind: "all", date: "2026-03-01" },
      { requestId: "req-1" }
    );
    expect(purgeOldMonitoringEventsMock).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.requestId).toBe("req-1");
    expect(body.platform?.purgedMonitoringEvents).toBe(11);
    expect(JSON.stringify(body)).not.toContain("token");
  });

  it("returns 502 sanitized when dealer maintenance fails", async () => {
    callDealerMonitoringMaintenanceRunMock.mockResolvedValueOnce({
      ok: false,
      error: { status: 500, message: "postgres://secret token=abc" },
    });
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/platform/monitoring/maintenance/run", {
        method: "POST",
        headers: { "x-cron-secret": "cron-secret" },
        body: JSON.stringify({ kind: "purge" }),
      })
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error?.code).toBe("UPSTREAM_ERROR");
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("token=");
  });
});
