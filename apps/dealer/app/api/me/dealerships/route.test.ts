/** @jest-environment node */
/**
 * GET /api/me/dealerships: list dealerships the user is a member of, with isActive.
 */
jest.mock("@/lib/auth", () => ({
  requireUserFromRequest: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = "ApiError";
    }
  },
}));
jest.mock("@/lib/tenant", () => ({
  getActiveDealershipId: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    membership: { findMany: jest.fn() },
  },
  __esModule: true,
}));

import { requireUserFromRequest } from "@/lib/auth";
import { getActiveDealershipId } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { GET } from "./route";

function nextRequest(): import("next/server").NextRequest {
  return { headers: new Headers() } as unknown as import("next/server").NextRequest;
}

describe("GET /api/me/dealerships", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireUserFromRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
    });
    (getActiveDealershipId as jest.Mock).mockResolvedValue("deal-1");
  });

  it("returns 401 when not authenticated", async () => {
    (requireUserFromRequest as jest.Mock).mockRejectedValueOnce(
      new (await import("@/lib/auth")).ApiError("UNAUTHORIZED", "Not authenticated")
    );
    const res = await GET(nextRequest());
    expect(res.status).toBe(401);
  });

  it("returns list of dealerships with role and isActive", async () => {
    (prisma.membership.findMany as jest.Mock).mockResolvedValueOnce([
      {
        dealershipId: "deal-1",
        dealership: { id: "deal-1", name: "Dealership A" },
        role: { id: "r1", key: "admin", name: "Admin" },
      },
      {
        dealershipId: "deal-2",
        dealership: { id: "deal-2", name: "Dealership B" },
        role: { id: "r2", key: "sales", name: "Sales" },
      },
    ]);
    (getActiveDealershipId as jest.Mock).mockResolvedValue("deal-1");
    const res = await GET(nextRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.dealerships).toHaveLength(2);
    expect(body.data.dealerships[0]).toMatchObject({
      dealershipId: "deal-1",
      dealershipName: "Dealership A",
      roleKey: "admin",
      roleName: "Admin",
      isActive: true,
    });
    expect(body.data.dealerships[1]).toMatchObject({
      dealershipId: "deal-2",
      dealershipName: "Dealership B",
      roleKey: "sales",
      roleName: "Sales",
      isActive: false,
    });
  });
});
