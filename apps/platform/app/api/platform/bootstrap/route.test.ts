/**
 * Bootstrap API: 401 without auth, 403 when disabled or wrong secret, 200 with valid auth + secret.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getPlatformUserIdFromRequestMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  platformUser: { upsert: vi.fn().mockResolvedValue({ id: "user-1", role: "PLATFORM_OWNER" }) },
}));
const platformAuditLogMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/platform-auth", () => ({
  getPlatformUserIdFromRequest: getPlatformUserIdFromRequestMock,
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ platformAuditLog: platformAuditLogMock }));

import { POST } from "./route";

describe("POST /api/platform/bootstrap", () => {
  const originalEnv = process.env.PLATFORM_BOOTSTRAP_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_BOOTSTRAP_SECRET = "the-secret";
  });

  afterEach(() => {
    process.env.PLATFORM_BOOTSTRAP_SECRET = originalEnv;
  });

  it("returns 403 when PLATFORM_BOOTSTRAP_SECRET is not set", async () => {
    process.env.PLATFORM_BOOTSTRAP_SECRET = "";
    const req = new Request("http://localhost/api/platform/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "the-secret" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("BOOTSTRAP_DISABLED");
    expect(getPlatformUserIdFromRequestMock).not.toHaveBeenCalled();
    expect(prismaMock.platformUser.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when body is invalid (missing secret)", async () => {
    const req = new Request("http://localhost/api/platform/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
    expect(getPlatformUserIdFromRequestMock).not.toHaveBeenCalled();
  });

  it("returns 403 when secret does not match", async () => {
    getPlatformUserIdFromRequestMock.mockResolvedValue("user-1");
    const req = new Request("http://localhost/api/platform/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "wrong-secret" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("INVALID_SECRET");
    expect(prismaMock.platformUser.upsert).not.toHaveBeenCalled();
    expect(platformAuditLogMock).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    getPlatformUserIdFromRequestMock.mockResolvedValue(null);
    const req = new Request("http://localhost/api/platform/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "the-secret" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error?.code).toBe("UNAUTHORIZED");
    expect(prismaMock.platformUser.upsert).not.toHaveBeenCalled();
    expect(platformAuditLogMock).not.toHaveBeenCalled();
  });

  it("returns 200, upserts platform_user and writes audit when auth + secret valid", async () => {
    getPlatformUserIdFromRequestMock.mockResolvedValue("user-uuid-123");
    const req = new Request("http://localhost/api/platform/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "the-secret" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(prismaMock.platformUser.upsert).toHaveBeenCalledWith({
      where: { id: "user-uuid-123" },
      create: { id: "user-uuid-123", role: "PLATFORM_OWNER" },
      update: { role: "PLATFORM_OWNER" },
    });
    expect(platformAuditLogMock).toHaveBeenCalledWith({
      actorPlatformUserId: "user-uuid-123",
      action: "platform.owner_bootstrap",
      targetType: "platform_user",
      targetId: "user-uuid-123",
    });
  });
});
