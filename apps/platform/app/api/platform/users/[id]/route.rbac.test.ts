/**
 * Platform users [id]: GET for read roles; PATCH/DELETE 403 for non-owner before lookup.
 * Last owner protection: 409 when demoting/disabling/deleting last owner.
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
  prisma: {
    platformUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/audit", () => ({
  platformAuditLog: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { GET, PATCH, DELETE } from "./route";

const userId1 = "00000000-0000-0000-0000-000000000001";
const userId2 = "00000000-0000-0000-0000-000000000002";

describe("Platform users [id] GET RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns 200 for PLATFORM_OWNER when user exists", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    (prisma.platformUser.findUnique as jest.Mock).mockResolvedValueOnce({
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
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    (prisma.platformUser.findUnique as jest.Mock).mockResolvedValueOnce(null);
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
    jest.clearAllMocks();
  });

  it("PATCH returns 403 for non-owner before lookup", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "s-1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/users/" + userId1, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "PLATFORM_COMPLIANCE" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(403);
    expect(prisma.platformUser.findUnique).not.toHaveBeenCalled();
    expect(prisma.platformUser.update).not.toHaveBeenCalled();
  });

  it("PATCH writes audit with platform_user.role_changed when owner updates role", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    const existing = {
      id: userId1,
      role: "PLATFORM_SUPPORT",
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    };
    const updated = { ...existing, role: "PLATFORM_COMPLIANCE" as const };
    (prisma.platformUser.findUnique as jest.Mock).mockResolvedValueOnce(existing);
    (prisma.platformUser.count as jest.Mock).mockResolvedValue(1);
    (prisma.platformUser.update as jest.Mock).mockResolvedValue(updated);
    const req = new Request("http://localhost/api/platform/users/" + userId1, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "PLATFORM_COMPLIANCE" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(200);
    expect(platformAuditLog).toHaveBeenCalledWith(
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
    jest.clearAllMocks();
  });

  it("PATCH returns 409 when demoting last PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    const existing = {
      id: userId1,
      role: "PLATFORM_OWNER" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    };
    (prisma.platformUser.findUnique as jest.Mock).mockResolvedValueOnce(existing);
    (prisma.platformUser.count as jest.Mock).mockResolvedValue(0);
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
    expect(prisma.platformUser.update).not.toHaveBeenCalled();
  });

  it("PATCH succeeds when two owners and demoting one", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    const existing = {
      id: userId1,
      role: "PLATFORM_OWNER" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    };
    const updated = { ...existing, role: "PLATFORM_SUPPORT" as const };
    (prisma.platformUser.findUnique as jest.Mock).mockResolvedValueOnce(existing);
    (prisma.platformUser.count as jest.Mock).mockResolvedValue(1);
    (prisma.platformUser.update as jest.Mock).mockResolvedValue(updated);
    const req = new Request("http://localhost/api/platform/users/" + userId1, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "PLATFORM_SUPPORT" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(200);
    expect(prisma.platformUser.update).toHaveBeenCalled();
  });

  it("DELETE returns 409 when deleting last PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    const existing = {
      id: userId1,
      role: "PLATFORM_OWNER" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    };
    (prisma.platformUser.findUnique as jest.Mock).mockResolvedValueOnce(existing);
    (prisma.platformUser.count as jest.Mock).mockResolvedValue(0);
    const req = new Request("http://localhost/api/platform/users/" + userId1, { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: userId1 }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error?.code).toBe("CONFLICT");
    expect(prisma.platformUser.delete).not.toHaveBeenCalled();
  });
});
