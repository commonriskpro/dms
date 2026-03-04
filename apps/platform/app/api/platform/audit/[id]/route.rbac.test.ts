/**
 * Platform RBAC: GET audit by id — 403 when not authorized (before lookup).
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
jest.mock("@/lib/db", () => ({
  prisma: { platformAuditLog: { findUnique: jest.fn() } },
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { GET } from "./route";

describe("Platform GET /api/platform/audit/[id] RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when role not allowed (guard before lookup)", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "UNKNOWN" });
    (requirePlatformRole as jest.Mock).mockImplementationOnce(() => {
      throw new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403);
    });
    const req = new Request("http://localhost/api/platform/audit/audit-1");
    const res = await GET(req, { params: Promise.resolve({ id: "audit-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("FORBIDDEN");
    expect(prisma.platformAuditLog.findUnique).not.toHaveBeenCalled();
  });

  it("returns 200 when authorized and entry exists", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.platformAuditLog.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "audit-1",
      actorPlatformUserId: "u1",
      action: "application.created",
      targetType: "application",
      targetId: "app-1",
      beforeState: null,
      afterState: { status: "APPLIED" },
      reason: null,
      requestId: null,
      idempotencyKey: null,
      createdAt: new Date("2025-02-28T12:00:00Z"),
    });
    const req = new Request("http://localhost/api/platform/audit/audit-1");
    const res = await GET(req, { params: Promise.resolve({ id: "audit-1" }) });
    if (res.status !== 200) {
      const body = await res.json();
      console.error("[audit [id] route] status", res.status, "body", JSON.stringify(body, null, 2));
    }
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("audit-1");
    expect(json.action).toBe("application.created");
  });

  it("redacts sensitive keys in beforeState/afterState in response", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.platformAuditLog.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "audit-2",
      actorPlatformUserId: "u1",
      action: "owner.invite",
      targetType: "Invite",
      targetId: null,
      beforeState: { token: "raw-jwt", password: "hidden" },
      afterState: { email: "owner@dealership.com", accept_url: "https://app.com/accept?k=secret", role: "OWNER" },
      reason: null,
      requestId: null,
      idempotencyKey: null,
      createdAt: new Date("2025-02-28T12:00:00Z"),
    });
    const req = new Request("http://localhost/api/platform/audit/audit-2");
    const res = await GET(req, { params: Promise.resolve({ id: "audit-2" }) });
    if (res.status !== 200) {
      const body = await res.json();
      console.error("[audit [id] redact] status", res.status, "body", JSON.stringify(body, null, 2));
    }
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.beforeState).toEqual({ token: "[REDACTED]", password: "[REDACTED]" });
    expect(json.afterState).toEqual({
      email: "[REDACTED]",
      accept_url: "[REDACTED]",
      role: "OWNER",
    });
  });
});
