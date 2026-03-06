/**
 * Monitoring events: RBAC and returns recentAudit + summaryLast24h.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    platformAuditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { GET } from "./route";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";

describe("GET /api/platform/monitoring/events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.platformAuditLog.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.platformAuditLog.count as jest.Mock).mockResolvedValue(0);
  });

  it("returns 200 with recentAudit and summaryLast24h for platform user", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.platformAuditLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: "log-1",
        actorPlatformUserId: "u1",
        action: "dealership.created",
        targetType: "platform_dealership",
        targetId: "d1",
        beforeState: null,
        afterState: {},
        reason: null,
        requestId: null,
        createdAt: new Date(),
      },
    ]);
    (prisma.platformAuditLog.count as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    const req = new Request("http://localhost/api/platform/monitoring/events?limit=50");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recentAudit).toHaveLength(1);
    expect(json.meta).toEqual({ total: 1, limit: 50, offset: 0 });
    expect(json.summaryLast24h).toEqual({ applicationApproved: 2, applicationRejected: 3 });
  });
});
