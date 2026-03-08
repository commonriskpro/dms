/** @jest-environment node */
/**
 * Dealer GET /api/auth/onboarding-status: auth, nextAction, no token leakage.
 */
jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, requireUser: jest.fn() };
});
jest.mock("@/lib/tenant", () => ({
  getActiveDealershipId: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    membership: { findMany: jest.fn() },
    dealershipInvite: { count: jest.fn() },
  },
}));
jest.mock("@/modules/onboarding/service/onboarding", () => ({
  getOrCreateState: jest.fn().mockResolvedValue({
    isComplete: false,
    currentStep: 1,
  }),
}));

import { requireUser, ApiError } from "@/lib/auth";
import { getActiveDealershipId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { GET } from "./route";

describe("GET /api/auth/onboarding-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireUser as jest.Mock).mockRejectedValueOnce(new ApiError("UNAUTHORIZED", "Not authenticated"));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("membershipsCount=0, pendingInvitesCount>0 → nextAction CHECK_EMAIL_FOR_INVITE", async () => {
    (requireUser as jest.Mock).mockResolvedValueOnce({
      userId: "b1000000-0000-0000-0000-000000000001",
      email: "user@example.com",
    });
    (getActiveDealershipId as jest.Mock).mockResolvedValueOnce(null);
    (prisma.membership.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.dealershipInvite.count as jest.Mock).mockResolvedValueOnce(1);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nextAction).toBe("CHECK_EMAIL_FOR_INVITE");
    expect(json.data.membershipsCount).toBe(0);
    expect(json.data.pendingInvitesCount).toBe(1);
    expect(json.data.token).toBeUndefined();
  });

  it("membershipsCount>0, no activeDealership → nextAction SELECT_DEALERSHIP", async () => {
    (requireUser as jest.Mock).mockResolvedValueOnce({
      userId: "b1000000-0000-0000-0000-000000000001",
      email: "user@example.com",
    });
    (getActiveDealershipId as jest.Mock).mockResolvedValueOnce(null);
    (prisma.membership.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "m1" },
    ]);
    (prisma.dealershipInvite.count as jest.Mock).mockResolvedValueOnce(0);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nextAction).toBe("SELECT_DEALERSHIP");
    expect(json.data.membershipsCount).toBe(1);
    expect(json.data.hasActiveDealership).toBe(false);
    expect(json.data.token).toBeUndefined();
  });

  it("response has pendingInvitesCount as number only, no invite details or tokens", async () => {
    (requireUser as jest.Mock).mockResolvedValueOnce({
      userId: "b1000000-0000-0000-0000-000000000001",
      email: "user@example.com",
    });
    (getActiveDealershipId as jest.Mock).mockResolvedValueOnce(null);
    (prisma.membership.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.dealershipInvite.count as jest.Mock).mockResolvedValueOnce(2);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.data.pendingInvitesCount).toBe("number");
    expect(json.data.pendingInvitesCount).toBe(2);
    expect(json.data.invites).toBeUndefined();
    expect(json.data.token).toBeUndefined();
    expect(json.data.inviteId).toBeUndefined();
  });

  it("has active dealership → nextAction NONE, no tokens in response", async () => {
    (requireUser as jest.Mock).mockResolvedValueOnce({
      userId: "b1000000-0000-0000-0000-000000000001",
      email: "user@example.com",
    });
    (getActiveDealershipId as jest.Mock).mockResolvedValueOnce("b2000000-0000-0000-0000-000000000002");
    (prisma.membership.findMany as jest.Mock).mockResolvedValueOnce([{ id: "m1" }]);
    (prisma.dealershipInvite.count as jest.Mock).mockResolvedValueOnce(0);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nextAction).toBe("NONE");
    expect(json.data.hasActiveDealership).toBe(true);
    expect(json.data.activeDealershipIdTail).toBeDefined();
    expect(json.data.onboardingComplete).toBe(false);
    expect(json.data.onboardingCurrentStep).toBe(1);
    expect(json.data.token).toBeUndefined();
    expect(json.token).toBeUndefined();
  });
});
