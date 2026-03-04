/**
 * Bootstrap API: 401 without auth, 403 when disabled or wrong secret, 200 with valid auth + secret.
 */
jest.mock("@/lib/platform-auth", () => ({
  getPlatformUserIdFromRequest: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    platformUser: { upsert: jest.fn().mockResolvedValue({ id: "user-1", role: "PLATFORM_OWNER" }) },
  },
}));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn().mockResolvedValue(undefined) }));

import { getPlatformUserIdFromRequest } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { POST } from "./route";

describe("POST /api/platform/bootstrap", () => {
  const originalEnv = process.env.PLATFORM_BOOTSTRAP_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(getPlatformUserIdFromRequest).not.toHaveBeenCalled();
    expect(prisma.platformUser.upsert).not.toHaveBeenCalled();
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
    expect(getPlatformUserIdFromRequest).not.toHaveBeenCalled();
  });

  it("returns 403 when secret does not match", async () => {
    (getPlatformUserIdFromRequest as jest.Mock).mockResolvedValue("user-1");
    const req = new Request("http://localhost/api/platform/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "wrong-secret" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("INVALID_SECRET");
    expect(prisma.platformUser.upsert).not.toHaveBeenCalled();
    expect(platformAuditLog).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    (getPlatformUserIdFromRequest as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost/api/platform/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "the-secret" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error?.code).toBe("UNAUTHORIZED");
    expect(prisma.platformUser.upsert).not.toHaveBeenCalled();
    expect(platformAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200, upserts platform_user and writes audit when auth + secret valid", async () => {
    (getPlatformUserIdFromRequest as jest.Mock).mockResolvedValue("user-uuid-123");
    const req = new Request("http://localhost/api/platform/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: "the-secret" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(prisma.platformUser.upsert).toHaveBeenCalledWith({
      where: { id: "user-uuid-123" },
      create: { id: "user-uuid-123", role: "PLATFORM_OWNER" },
      update: { role: "PLATFORM_OWNER" },
    });
    expect(platformAuditLog).toHaveBeenCalledWith({
      actorPlatformUserId: "user-uuid-123",
      action: "platform.owner_bootstrap",
      targetType: "platform_user",
      targetId: "user-uuid-123",
    });
  });
});
