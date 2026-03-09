/**
 * Platform subscriptions API RBAC: auth and PLATFORM_OWNER for POST; allowed roles for GET.
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
jest.mock("@/lib/service/subscriptions", () => ({
  createSubscription: jest.fn(),
}));
jest.mock("@/lib/db/subscriptions", () => ({
  listSubscriptions: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    platformSubscription: { findUnique: jest.fn() },
  },
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import * as subscriptionsService from "@/lib/service/subscriptions";
import * as subscriptionsDb from "@/lib/db/subscriptions";
import { prisma } from "@/lib/db";
import { GET, POST } from "./route";

describe("Platform subscriptions API RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (subscriptionsDb.listSubscriptions as jest.Mock).mockResolvedValue({
      data: [],
      total: 0,
    });
  });

  it("GET returns 403 when requirePlatformAuth throws", async () => {
    (requirePlatformAuth as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Platform access required", 403)
    );
    const req = new Request("http://localhost/api/platform/subscriptions");
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(subscriptionsDb.listSubscriptions).not.toHaveBeenCalled();
  });

  it("GET returns 200 when user has allowed role", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    const req = new Request("http://localhost/api/platform/subscriptions?limit=25&offset=0");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(subscriptionsDb.listSubscriptions).toHaveBeenCalled();
  });

  it("POST returns 403 when user is not PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "PLATFORM_OWNER required", 403)
    );
    const req = new Request("http://localhost/api/platform/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealershipId: "00000000-0000-0000-0000-000000000001",
        plan: "STARTER",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(prisma.platformSubscription.findUnique).not.toHaveBeenCalled();
    expect(subscriptionsService.createSubscription).not.toHaveBeenCalled();
  });

  it("POST returns 201 when user is PLATFORM_OWNER and dealership has no subscription", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.platformSubscription.findUnique as jest.Mock).mockResolvedValue(null);
    (subscriptionsService.createSubscription as jest.Mock).mockResolvedValue({
      id: "sub-1",
      dealershipId: "00000000-0000-0000-0000-000000000001",
      plan: "STARTER",
      billingStatus: "TRIAL",
      billingProvider: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request("http://localhost/api/platform/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealershipId: "00000000-0000-0000-0000-000000000001",
        plan: "STARTER",
        billingStatus: "TRIAL",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(subscriptionsService.createSubscription).toHaveBeenCalled();
  });
});
