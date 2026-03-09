/**
 * Platform dashboard: RBAC and response shape.
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
    platformDealership: { count: jest.fn() },
    application: { count: jest.fn(), findMany: jest.fn() },
    platformUser: { count: jest.fn() },
    platformAuditLog: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/service/subscriptions", () => ({
  getPlatformStats: jest.fn().mockResolvedValue({
    totalDealerships: 5,
    activeDealerships: 3,
    totalSubscriptions: 4,
    activeSubscriptions: 2,
    trialSubscriptions: 1,
    monthlyRevenueEstimate: 500,
  }),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { GET } from "./route";

describe("Platform dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.platformDealership.count as jest.Mock)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3);
    (prisma.application.count as jest.Mock)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    (prisma.platformUser.count as jest.Mock).mockResolvedValue(4);
    (prisma.application.findMany as jest.Mock).mockResolvedValue([
      {
        id: "app-1",
        status: "APPLIED",
        displayName: "Acme",
        legalName: "Acme Inc",
        contactEmail: "a@acme.com",
        createdAt: new Date("2025-01-01"),
      },
    ]);
    (prisma.platformAuditLog.findMany as jest.Mock).mockResolvedValue([
      {
        id: "audit-1",
        action: "application.approved",
        targetType: "application",
        targetId: "app-1",
        createdAt: new Date("2025-01-02"),
      },
    ]);
  });

  it("returns 403 when user has no platform role", async () => {
    (requirePlatformRole as jest.Mock).mockImplementationOnce(() => {
      throw new PlatformApiError("FORBIDDEN", "Insufficient role", 403);
    });
    const req = new Request("http://localhost/api/platform/dashboard");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 with kpis, recentApplications, recentAudit", async () => {
    const req = new Request("http://localhost/api/platform/dashboard");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.kpis).toBeDefined();
    expect(typeof json.kpis.totalDealerships).toBe("number");
    expect(typeof json.kpis.activeDealerships).toBe("number");
    expect(typeof json.kpis.totalApplications).toBe("number");
    expect(typeof json.kpis.appliedApplications).toBe("number");
    expect(typeof json.kpis.totalPlatformUsers).toBe("number");
    expect(typeof json.kpis.applicationsLast7Days).toBe("number");
    expect(json.kpis.activeSubscriptions).toBe(2);
    expect(json.kpis.trialSubscriptions).toBe(1);
    expect(json.kpis.monthlyRevenueEstimate).toBe(500);
    expect(Array.isArray(json.recentApplications)).toBe(true);
    expect(Array.isArray(json.recentAudit)).toBe(true);
    if (json.recentApplications.length > 0) {
      expect(json.recentApplications[0]).toMatchObject({
        id: "app-1",
        status: "APPLIED",
        displayName: "Acme",
        createdAt: "2025-01-01T00:00:00.000Z",
      });
    }
  });
});
