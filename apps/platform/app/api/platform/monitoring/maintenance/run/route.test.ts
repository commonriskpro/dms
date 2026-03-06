jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
  PlatformApiError: class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  },
}));

jest.mock("@/lib/monitoring-retention", () => ({
  purgeOldMonitoringEvents: jest.fn(),
}));

jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerMonitoringMaintenanceRun: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { purgeOldMonitoringEvents } from "@/lib/monitoring-retention";
import { callDealerMonitoringMaintenanceRun } from "@/lib/call-dealer-internal";

describe("POST /api/platform/monitoring/maintenance/run", () => {
  const prevEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    prevEnv.CRON_SECRET = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "cron-secret";

    (purgeOldMonitoringEvents as jest.Mock).mockResolvedValue({
      deletedCount: 11,
      cutoffIso: "2026-03-01T00:00:00.000Z",
      touchedTables: ["platform_monitoring_events"],
    });
    (callDealerMonitoringMaintenanceRun as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ok: true, requestId: "dealer-req", purged: { rateLimitEventsDeleted: 3 } },
    });
  });

  afterEach(() => {
    if (prevEnv.CRON_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevEnv.CRON_SECRET;
    jest.restoreAllMocks();
  });

  it("returns 401 without cron and without auth", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/platform/monitoring/maintenance/run", {
        method: "POST",
        body: JSON.stringify({ kind: "all" }),
      })
    );
    expect(res.status).toBe(401);
    expect(callDealerMonitoringMaintenanceRun).not.toHaveBeenCalled();
  });

  it("returns 403 for non-owner without valid cron header", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient role", 403)
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
    expect(callDealerMonitoringMaintenanceRun).not.toHaveBeenCalled();
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
    expect(requirePlatformAuth).not.toHaveBeenCalled();
    expect(callDealerMonitoringMaintenanceRun).toHaveBeenCalledWith(
      { kind: "all", date: "2026-03-01" },
      { requestId: "req-1" }
    );
    expect(purgeOldMonitoringEvents).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.requestId).toBe("req-1");
    expect(body.platform?.purgedMonitoringEvents).toBe(11);
    expect(JSON.stringify(body)).not.toContain("token");
  });

  it("returns 502 sanitized when dealer maintenance fails", async () => {
    (callDealerMonitoringMaintenanceRun as jest.Mock).mockResolvedValueOnce({
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
