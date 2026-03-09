/**
 * Platform PATCH subscription RBAC: PLATFORM_OWNER required.
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
  updateSubscriptionStatus: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import * as subscriptionsService from "@/lib/service/subscriptions";
import { PATCH } from "./route";

describe("Platform PATCH /api/platform/subscriptions/[id] RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when user is not PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "PLATFORM_OWNER required", 403)
    );
    const req = new Request("http://localhost/api/platform/subscriptions/sub-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "PRO" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(403);
    expect(subscriptionsService.updateSubscriptionStatus).not.toHaveBeenCalled();
  });

  it("returns 200 when PLATFORM_OWNER and subscription exists", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (subscriptionsService.updateSubscriptionStatus as jest.Mock).mockResolvedValue({
      id: "sub-1",
      dealershipId: "deal-1",
      plan: "PRO",
      billingStatus: "ACTIVE",
      billingProvider: null,
      billingCustomerId: null,
      billingSubscriptionId: null,
      currentPeriodEnd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const req = new Request("http://localhost/api/platform/subscriptions/sub-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "PRO" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "sub-1" }) });
    expect(res.status).toBe(200);
    expect(subscriptionsService.updateSubscriptionStatus).toHaveBeenCalledWith(
      "user-1",
      "sub-1",
      expect.objectContaining({ plan: "PRO" })
    );
  });
});
