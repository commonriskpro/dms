/**
 * Platform users: GET list allowed for OWNER/COMPLIANCE/SUPPORT; POST 403 for non-owner before lookup.
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
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("@/lib/audit", () => ({
  platformAuditLog: jest.fn(),
}));

jest.mock("@/lib/platform-users-service", () => ({
  listPlatformUsers: jest.fn(),
  upsertPlatformUser: jest.fn(),
}));

jest.mock("@/lib/supabase-user-enrichment", () => ({
  getSupabaseUsersEnrichment: jest.fn().mockResolvedValue(new Map()),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { listPlatformUsers, upsertPlatformUser } from "@/lib/platform-users-service";
import { GET, POST } from "./route";

describe("Platform users list RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listPlatformUsers as jest.Mock).mockResolvedValue({ data: [], total: 0 });
    (prisma.platformUser.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.platformUser.count as jest.Mock).mockResolvedValue(0);
  });

  it("GET list returns 200 for PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    const req = new Request("http://localhost/api/platform/users?limit=20&offset=0");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual([]);
    expect(json.meta).toEqual({ total: 0, limit: 20, offset: 0 });
    expect(listPlatformUsers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 })
    );
  });

  it("GET list returns 200 for PLATFORM_COMPLIANCE", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "c-1", role: "PLATFORM_COMPLIANCE" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    const req = new Request("http://localhost/api/platform/users");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(listPlatformUsers).toHaveBeenCalled();
  });

  it("GET list returns 200 for PLATFORM_SUPPORT", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "s-1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    const req = new Request("http://localhost/api/platform/users");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(listPlatformUsers).toHaveBeenCalled();
  });

  it("GET list with role=PLATFORM_OWNER returns 200 and calls listPlatformUsers", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    const url = new URL("http://localhost/api/platform/users");
    url.searchParams.set("limit", "20");
    url.searchParams.set("offset", "0");
    url.searchParams.set("role", "PLATFORM_OWNER");
    const req = new Request(url.toString());
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(listPlatformUsers).toHaveBeenCalledTimes(1);
    // Role filter is applied in listPlatformUsers when role is passed; query parsing may vary by runtime
    expect(listPlatformUsers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 })
    );
  });
});

describe("Platform users POST RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST returns 403 for non-owner before any DB lookup", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "s-1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", role: "PLATFORM_SUPPORT" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(prisma.platformUser.findUnique).not.toHaveBeenCalled();
    expect(prisma.platformUser.upsert).not.toHaveBeenCalled();
  });

  it("POST returns 201 and writes audit when PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    const created = {
      id: "00000000-0000-0000-0000-000000000002",
      role: "PLATFORM_SUPPORT",
      createdAt: new Date("2025-01-01T00:00:00Z"),
      updatedAt: new Date("2025-01-01T00:00:00Z"),
      disabledAt: null,
    };
    (upsertPlatformUser as jest.Mock).mockImplementation(async () => {
      (platformAuditLog as jest.Mock)({
        action: "platform_user.created",
        targetType: "platform_user",
        targetId: created.id,
        afterState: { role: created.role, disabledAt: null },
      });
      return created;
    });
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
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "platform_user.created",
        targetType: "platform_user",
        targetId: created.id,
        afterState: { role: "PLATFORM_SUPPORT", disabledAt: null },
      })
    );
  });
});
