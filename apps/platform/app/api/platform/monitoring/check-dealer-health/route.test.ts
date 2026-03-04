/**
 * Auth: CRON_SECRET header OR platform OWNER. Prefer CRON_SECRET when present.
 * 503 when DEALER_INTERNAL_API_URL not configured.
 */

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

jest.mock("@/lib/check-dealer-health-service", () => ({
  checkDealerHealth: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { checkDealerHealth } from "@/lib/check-dealer-health-service";

beforeEach(() => {
  jest.clearAllMocks();
  (checkDealerHealth as jest.Mock).mockResolvedValue({
    ok: true,
    upstreamStatus: 200,
    eventCreated: null,
    alertSent: false,
  });
});

const baseEnv: Record<string, string | undefined> = {};
function captureEnv() {
  baseEnv.CRON_SECRET = process.env.CRON_SECRET;
  baseEnv.DEALER_INTERNAL_API_URL = process.env.DEALER_INTERNAL_API_URL;
}
function restoreEnv() {
  if (baseEnv.CRON_SECRET !== undefined) process.env.CRON_SECRET = baseEnv.CRON_SECRET;
  if (baseEnv.DEALER_INTERNAL_API_URL !== undefined)
    process.env.DEALER_INTERNAL_API_URL = baseEnv.DEALER_INTERNAL_API_URL;
}

describe("POST /api/platform/monitoring/check-dealer-health", () => {
  beforeEach(() => {
    captureEnv();
    process.env.DEALER_INTERNAL_API_URL = "https://dealer.example.com";
  });
  afterEach(restoreEnv);

  it("returns 401 when unauthenticated and no CRON_SECRET", async () => {
    process.env.CRON_SECRET = "cron-secret-123";
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const req = new Request("http://localhost/api/platform/monitoring/check-dealer-health", {
      method: "POST",
    });
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(checkDealerHealth).not.toHaveBeenCalled();
  });

  it("returns 200 when CRON_SECRET header matches", async () => {
    process.env.CRON_SECRET = "cron-secret-123";
    const req = new Request("http://localhost/api/platform/monitoring/check-dealer-health", {
      method: "POST",
      headers: { "x-cron-secret": "cron-secret-123" },
    });
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(requirePlatformAuth).not.toHaveBeenCalled();
    expect(checkDealerHealth).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.upstreamStatus).toBe(200);
  });

  it("returns 401 when CRON_SECRET header wrong and user not authenticated", async () => {
    process.env.CRON_SECRET = "cron-secret-123";
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const req = new Request("http://localhost/api/platform/monitoring/check-dealer-health", {
      method: "POST",
      headers: { "x-cron-secret": "wrong-secret" },
    });
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(checkDealerHealth).not.toHaveBeenCalled();
  });

  it("returns 200 when user is PLATFORM_OWNER (no CRON_SECRET)", async () => {
    delete process.env.CRON_SECRET;
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    const req = new Request("http://localhost/api/platform/monitoring/check-dealer-health", {
      method: "POST",
    });
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(requirePlatformAuth).toHaveBeenCalled();
    expect(requirePlatformRole).toHaveBeenCalledWith(
      { userId: "u1", role: "PLATFORM_OWNER" },
      ["PLATFORM_OWNER"]
    );
    expect(checkDealerHealth).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when user is not PLATFORM_OWNER and no valid CRON_SECRET", async () => {
    process.env.CRON_SECRET = "cron-secret-123";
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/monitoring/check-dealer-health", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
    });
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(checkDealerHealth).not.toHaveBeenCalled();
  });

  it("returns sanitized response payload for maintenance run", async () => {
    process.env.CRON_SECRET = "cron-secret-123";
    (checkDealerHealth as jest.Mock).mockResolvedValueOnce({
      ok: true,
      upstreamStatus: 200,
      eventCreated: "DEALER_HEALTH_RECOVER",
      alertSent: false,
      auditPurged: true,
    });
    const req = new Request("http://localhost/api/platform/monitoring/check-dealer-health", {
      method: "POST",
      headers: { "x-cron-secret": "cron-secret-123" },
    });
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      upstreamStatus: 200,
      eventCreated: "DEALER_HEALTH_RECOVER",
      alertSent: false,
    });
    expect(body).not.toHaveProperty("auditPurged");
    expect(JSON.stringify(body).toLowerCase()).not.toContain("purge");
  });

  it("returns 503 when DEALER_INTERNAL_API_URL not configured", async () => {
    process.env.CRON_SECRET = "cron-secret-123";
    process.env.DEALER_INTERNAL_API_URL = "";
    const req = new Request("http://localhost/api/platform/monitoring/check-dealer-health", {
      method: "POST",
      headers: { "x-cron-secret": "cron-secret-123" },
    });
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error?.code).toBe("CONFIG_ERROR");
    expect(body.error?.message).toContain("DEALER_INTERNAL_API_URL");
    expect(checkDealerHealth).not.toHaveBeenCalled();
  });

  it("returns sanitized 500 when maintenance service throws secret-like error", async () => {
    process.env.CRON_SECRET = "cron-secret-123";
    (checkDealerHealth as jest.Mock).mockRejectedValueOnce(
      new Error("database_url=postgres://user:pass@db.example.com token=abc@example.com")
    );
    const req = new Request("http://localhost/api/platform/monitoring/check-dealer-health", {
      method: "POST",
      headers: { "x-cron-secret": "cron-secret-123" },
    });
    const { POST } = await import("./route");
    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error?.code).toBe("INTERNAL_ERROR");
    expect(body.error?.message).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("database_url");
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("@example.com");
  });
});
