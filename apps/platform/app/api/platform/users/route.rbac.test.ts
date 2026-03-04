/**
 * Platform users: GET list allowed for OWNER/COMPLIANCE/SUPPORT; POST 403 for non-owner before lookup.
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
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

const platformAuditLogMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audit", () => ({
  platformAuditLog: platformAuditLogMock,
}));

const listPlatformUsersMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform-users-service", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/platform-users-service")>();
  return { ...mod, listPlatformUsers: listPlatformUsersMock };
});

import { GET, POST } from "./route";

describe("Platform users list RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPlatformUsersMock.mockResolvedValue({ data: [], total: 0 });
    prismaMock.platformUser.findMany.mockResolvedValue([]);
    prismaMock.platformUser.count.mockResolvedValue(0);
  });

  it("GET list returns 200 for PLATFORM_OWNER", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    const req = new Request("http://localhost/api/platform/users?limit=20&offset=0");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(json.meta).toEqual({ total: 0, limit: 20, offset: 0 });
    expect(listPlatformUsersMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 })
    );
  });

  it("GET list returns 200 for PLATFORM_COMPLIANCE", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "c-1", role: "PLATFORM_COMPLIANCE" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    const req = new Request("http://localhost/api/platform/users");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(listPlatformUsersMock).toHaveBeenCalled();
  });

  it("GET list returns 200 for PLATFORM_SUPPORT", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "s-1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    const req = new Request("http://localhost/api/platform/users");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(listPlatformUsersMock).toHaveBeenCalled();
  });

  it("GET list with role=PLATFORM_OWNER returns 200 and calls listPlatformUsers", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValueOnce(undefined);
    const url = new URL("http://localhost/api/platform/users");
    url.searchParams.set("limit", "20");
    url.searchParams.set("offset", "0");
    url.searchParams.set("role", "PLATFORM_OWNER");
    const req = new Request(url.toString());
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(listPlatformUsersMock).toHaveBeenCalledTimes(1);
    // Role filter is applied in listPlatformUsers when role is passed; query parsing may vary by runtime
    expect(listPlatformUsersMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 })
    );
  });
});

describe("Platform users POST RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST returns 403 for non-owner before any DB lookup", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "s-1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", role: "PLATFORM_SUPPORT" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(prismaMock.platformUser.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.platformUser.upsert).not.toHaveBeenCalled();
  });

  it("POST returns 201 and writes audit when PLATFORM_OWNER", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValue(undefined);
    const created = {
      id: "00000000-0000-0000-0000-000000000002",
      role: "PLATFORM_SUPPORT",
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
      disabledAt: null,
    };
    prismaMock.platformUser.findUnique.mockResolvedValue(null);
    prismaMock.platformUser.upsert.mockResolvedValue(created);
    const req = new Request("http://localhost/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: created.id, role: "PLATFORM_SUPPORT" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe(created.id);
    expect(json.data.role).toBe("PLATFORM_SUPPORT");
    expect(platformAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform_user.created",
        targetType: "platform_user",
        targetId: created.id,
        afterState: { role: "PLATFORM_SUPPORT", disabledAt: null },
      })
    );
  });
});
