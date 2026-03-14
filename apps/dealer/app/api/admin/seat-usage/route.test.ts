/** @jest-environment node */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardAnyPermission: jest.fn(),
  };
});

jest.mock("@/lib/entitlements", () => ({
  countActiveMemberships: jest.fn(),
}));

jest.mock("@/lib/call-platform-internal", () => ({
  fetchEntitlementsForDealership: jest.fn(),
}));

import { getAuthContext, guardAnyPermission } from "@/lib/api/handler";
import * as entitlements from "@/lib/entitlements";
import * as callPlatform from "@/lib/call-platform-internal";
import { GET } from "./route";

function nextRequest(): Request {
  return new Request("http://localhost/api/admin/seat-usage");
}

describe("GET /api/admin/seat-usage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      dealershipId: "deal-1",
      permissions: ["admin.users.read"],
    });
    (guardAnyPermission as jest.Mock).mockResolvedValue(undefined);
    (entitlements.countActiveMemberships as jest.Mock).mockResolvedValue(3);
    (callPlatform.fetchEntitlementsForDealership as jest.Mock).mockResolvedValue({
      modules: ["dashboard", "inventory"],
      maxSeats: 10,
      features: {},
    });
  });

  it("returns 403 when user lacks admin.users.read and admin.memberships.read", async () => {
    const { ApiError } = await import("@/lib/auth");
    (getAuthContext as jest.Mock).mockResolvedValue({
      userId: "user-1",
      dealershipId: "deal-1",
      permissions: ["dashboard.read"],
    });
    (guardAnyPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));

    const res = await GET(nextRequest());
    expect(res.status).toBe(403);
  });

  it("returns 200 with usedSeats and maxSeats when user has permission", async () => {
    const res = await GET(nextRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ usedSeats: 3, maxSeats: 10 });
    expect(entitlements.countActiveMemberships).toHaveBeenCalledWith("deal-1");
    expect(callPlatform.fetchEntitlementsForDealership).toHaveBeenCalledWith("deal-1");
  });

  it("returns maxSeats undefined when entitlements return null maxSeats", async () => {
    (callPlatform.fetchEntitlementsForDealership as jest.Mock).mockResolvedValue({
      modules: ["dashboard"],
      maxSeats: null,
      features: {},
    });

    const res = await GET(nextRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.usedSeats).toBe(3);
    expect(body.maxSeats).toBeUndefined();
  });
});
