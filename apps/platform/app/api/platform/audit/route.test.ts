/**
 * Platform audit API: RBAC (401/403/200), pagination, filters, validation (422), redaction.
 */
jest.mock("@/lib/platform-auth", () => {
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
  return {
    requirePlatformAuth: jest.fn(),
    requirePlatformRole: jest.fn(),
    PlatformApiError,
  };
});

jest.mock("@/lib/db", () => ({
  prisma: {
    platformAuditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock("@dms/contracts", () => ({
  platformAuditQuerySchema: {
    safeParse: jest.fn((q: Record<string, string>) => ({
      success: true,
      data: {
        limit: Number(q?.limit) || 20,
        offset: Number(q?.offset) || 0,
        actor: q?.actor,
        action: q?.action,
        targetType: q?.targetType,
        targetId: q?.targetId,
        dateFrom: q?.dateFrom,
        dateTo: q?.dateTo,
      },
    })),
  },
}));

import { GET } from "./route";
import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { platformAuditQuerySchema } from "@dms/contracts";

let realPlatformAuditQuerySchema: { safeParse: (q: unknown) => { success: boolean; error?: { flatten: () => unknown } } };
beforeAll(async () => {
  const actual = (await jest.requireActual("@dms/contracts")) as { platformAuditQuerySchema: typeof realPlatformAuditQuerySchema };
  realPlatformAuditQuerySchema = actual.platformAuditQuerySchema;
});

describe("Platform audit API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (platformAuditQuerySchema.safeParse as jest.Mock).mockImplementation((q: Record<string, string>) => ({
      success: true,
      data: {
        limit: Number(q?.limit) || 20,
        offset: Number(q?.offset) || 0,
        actor: q?.actor,
        action: q?.action,
        targetType: q?.targetType,
        targetId: q?.targetId,
        dateFrom: q?.dateFrom,
        dateTo: q?.dateTo,
      },
    }));
  });

  it("returns 401 when not authenticated", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401)
    );
    const req = new Request("http://localhost/api/platform/audit");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(prisma.platformAuditLog.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when role not allowed (guard before DB)", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "SOME_OTHER" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/audit");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(prisma.platformAuditLog.findMany).not.toHaveBeenCalled();
  });

  it("returns 422 when dateFrom is invalid", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (platformAuditQuerySchema.safeParse as jest.Mock).mockImplementationOnce((q: unknown) =>
      realPlatformAuditQuerySchema.safeParse(q)
    );
    const req = new Request("http://localhost/api/platform/audit?dateFrom=not-a-date");
    const res = await GET(req);
    expect(res.status).toBe(422);
    expect(prisma.platformAuditLog.findMany).not.toHaveBeenCalled();
  });

  it("returns 422 when dateTo is invalid", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (platformAuditQuerySchema.safeParse as jest.Mock).mockImplementationOnce((q: unknown) =>
      realPlatformAuditQuerySchema.safeParse(q)
    );
    const req = new Request("http://localhost/api/platform/audit?dateTo=2025-13-45");
    const res = await GET(req);
    expect(res.status).toBe(422);
    expect(prisma.platformAuditLog.findMany).not.toHaveBeenCalled();
  });

  it("returns 422 when limit exceeds max (100)", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (platformAuditQuerySchema.safeParse as jest.Mock).mockImplementationOnce((q: unknown) =>
      realPlatformAuditQuerySchema.safeParse(q)
    );
    const req = new Request("http://localhost/api/platform/audit?limit=101");
    const res = await GET(req);
    expect(res.status).toBe(422);
    expect(prisma.platformAuditLog.findMany).not.toHaveBeenCalled();
  });

  it("applies filters and pagination to findMany (where, take, skip)", async () => {
    const actorId = "550e8400-e29b-41d4-a716-446655440000";
    const targetId = "660e8400-e29b-41d4-a716-446655440001";
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_COMPLIANCE" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    prisma.platformAuditLog.findMany.mockResolvedValueOnce([]);
    prisma.platformAuditLog.count.mockResolvedValueOnce(0);
    const req = new Request(
      `http://localhost/api/platform/audit?actor=${actorId}&action=provision&targetType=Dealership&targetId=${targetId}&dateFrom=2025-01-01&dateTo=2025-01-31T23:59:59Z&limit=10&offset=5`
    );
    await GET(req);
    expect(prisma.platformAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          actorPlatformUserId: actorId,
          action: { contains: "provision", mode: "insensitive" },
          targetType: "Dealership",
          targetId,
          createdAt: { gte: new Date("2025-01-01"), lte: new Date("2025-01-31T23:59:59Z") },
        },
        take: 10,
        skip: 5,
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("returns 200 with data and meta when authorized", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    prisma.platformAuditLog.findMany.mockResolvedValueOnce([
      {
        id: "a1",
        actorPlatformUserId: "u1",
        action: "dealership.created",
        targetType: "Dealership",
        targetId: "d1",
        beforeState: null,
        afterState: { status: "ACTIVE" },
        reason: null,
        requestId: null,
        idempotencyKey: null,
        createdAt: new Date("2025-02-28T12:00:00Z"),
      },
    ]);
    prisma.platformAuditLog.count.mockResolvedValueOnce(1);
    const req = new Request("http://localhost/api/platform/audit?limit=20&offset=0");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].action).toBe("dealership.created");
    expect(json.meta).toEqual({ limit: 20, offset: 0, total: 1 });
    expect(prisma.platformAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 })
    );
  });

  it("redacts sensitive keys in list beforeState/afterState", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    prisma.platformAuditLog.findMany.mockResolvedValueOnce([
      {
        id: "a1",
        actorPlatformUserId: "u1",
        action: "invite.sent",
        targetType: "Invite",
        targetId: null,
        beforeState: null,
        afterState: { email: "u@x.com", accept_url: "https://x.com/accept?token=secret", role: "OWNER" },
        reason: null,
        requestId: null,
        idempotencyKey: null,
        createdAt: new Date("2025-02-28T12:00:00Z"),
      },
    ]);
    prisma.platformAuditLog.count.mockResolvedValueOnce(1);
    const req = new Request("http://localhost/api/platform/audit?limit=20&offset=0");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].afterState).toEqual({
      email: "[REDACTED]",
      accept_url: "[REDACTED]",
      role: "OWNER",
    });
  });
});
