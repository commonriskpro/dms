/**
 * Platform users [id]: GET for read roles; PATCH/DELETE 403 for non-owner before lookup.
 * Last owner protection: 409 when demoting/disabling/deleting last owner.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
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

const prismaMock = vi.hoisted(() => ({
  platformUser: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const platformAuditLogMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audit", () => ({
  platformAuditLog: platformAuditLogMock,
}));

import { GET, PATCH, DELETE } from "./route";

const userId1 = "00000000-0000-0000-0000-000000000001";
const userId2 = "00000000-0000-0000-0000-000000000002";

describe("Platform users [id] GET RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 200 for PLATFORM_OWNER when user exists", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    prismaMock.platformUser.findUnique.mockResolvedValueOnce({
      id: userId1,
      role: "PLATFORM_SUPPORT",
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    });
    const res = await GET(new Request("http://localhost/api/platform/users/" + userId1), {
      params: Promise.resolve({ id: userId1 }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(userId1);
    expect(json.role).toBe("PLATFORM_SUPPORT");
  });

  it("GET returns 404 when user not found", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    prismaMock.platformUser.findUnique.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/platform/users/" + userId1), {
      params: Promise.resolve({ id: userId1 }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error?.code).toBe("NOT_FOUND");
  });
});

describe("Platform users [id] PATCH RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH returns 403 for non-owner before lookup", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "s-1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/users/" + userId1, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "PLATFORM_COMPLIANCE" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(403);
    expect(prismaMock.platformUser.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.platformUser.update).not.toHaveBeenCalled();
  });

  it("PATCH writes audit with platform_user.role_changed when owner updates role", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValue(undefined);
    const existing = {
      id: userId1,
      role: "PLATFORM_SUPPORT",
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    };
    const updated = { ...existing, role: "PLATFORM_COMPLIANCE" as const };
    prismaMock.platformUser.findUnique.mockResolvedValueOnce(existing);
    prismaMock.platformUser.count.mockResolvedValue(1);
    prismaMock.platformUser.update.mockResolvedValue(updated);
    const req = new Request("http://localhost/api/platform/users/" + userId1, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "PLATFORM_COMPLIANCE" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(200);
    expect(platformAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform_user.role_changed",
        targetType: "platform_user",
        targetId: userId1,
        beforeState: expect.objectContaining({ role: "PLATFORM_SUPPORT" }),
        afterState: expect.objectContaining({ role: "PLATFORM_COMPLIANCE" }),
      })
    );
  });
});

describe("Platform users [id] last owner protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH returns 409 when demoting last PLATFORM_OWNER", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValue(undefined);
    const existing = {
      id: userId1,
      role: "PLATFORM_OWNER" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    };
    prismaMock.platformUser.findUnique.mockResolvedValueOnce(existing);
    prismaMock.platformUser.count.mockResolvedValue(0);
    const req = new Request("http://localhost/api/platform/users/" + userId1, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "PLATFORM_SUPPORT" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error?.code).toBe("CONFLICT");
    expect(json.error?.message).toMatch(/last platform owner/i);
    expect(prismaMock.platformUser.update).not.toHaveBeenCalled();
  });

  it("PATCH succeeds when two owners and demoting one", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValue(undefined);
    const existing = {
      id: userId1,
      role: "PLATFORM_OWNER" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    };
    const updated = { ...existing, role: "PLATFORM_SUPPORT" as const };
    prismaMock.platformUser.findUnique.mockResolvedValueOnce(existing);
    prismaMock.platformUser.count.mockResolvedValue(1);
    prismaMock.platformUser.update.mockResolvedValue(updated);
    const req = new Request("http://localhost/api/platform/users/" + userId1, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "PLATFORM_SUPPORT" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(200);
    expect(prismaMock.platformUser.update).toHaveBeenCalled();
  });

  it("DELETE returns 409 when deleting last PLATFORM_OWNER", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValue(undefined);
    const existing = {
      id: userId1,
      role: "PLATFORM_OWNER" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    };
    prismaMock.platformUser.findUnique.mockResolvedValueOnce(existing);
    prismaMock.platformUser.count.mockResolvedValue(0);
    const req = new Request("http://localhost/api/platform/users/" + userId1, { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error?.code).toBe("CONFLICT");
    expect(prismaMock.platformUser.delete).not.toHaveBeenCalled();
  });
});
