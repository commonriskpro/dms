/** @jest-environment node */
/**
 * GET /api/me/current-dealership and POST /api/me/current-dealership.
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
  setActiveDealershipForUser: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn() }));
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: () => true,
  getClientIdentifier: () => "test-client",
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: jest.fn(), count: jest.fn() },
    dealership: { findUnique: jest.fn() },
    userActiveDealership: { findUnique: jest.fn() },
  },
  __esModule: true,
}));

import { requireUserFromRequest } from "@/lib/auth";
import { getActiveDealershipId, setActiveDealershipForUser } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { GET, POST } from "./route";

function nextRequest(body?: object): import("next/server").NextRequest {
  return {
    headers: new Headers(),
    json: () => Promise.resolve(body ?? {}),
  } as unknown as import("next/server").NextRequest;
}

describe("GET /api/me/current-dealership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireUserFromRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
    });
  });

  it("returns data null and availableCount when no active dealership", async () => {
    (getActiveDealershipId as jest.Mock).mockResolvedValue(null);
    (prisma.membership.count as jest.Mock).mockResolvedValue(2);
    const res = await GET(nextRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeNull();
    expect(data.availableCount).toBe(2);
  });

  it("returns current dealership and role when active is set", async () => {
    (getActiveDealershipId as jest.Mock).mockResolvedValue("deal-1");
    (prisma.dealership.findUnique as jest.Mock).mockResolvedValue({
      id: "deal-1",
      name: "My Dealership",
    });
    (prisma.membership.findFirst as jest.Mock).mockResolvedValue({
      role: { key: "admin", name: "Admin" },
    });
    (prisma.membership.count as jest.Mock).mockResolvedValue(1);
    const res = await GET(nextRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toMatchObject({
      dealershipId: "deal-1",
      dealershipName: "My Dealership",
      roleKey: "admin",
      roleName: "Admin",
    });
    expect(data.availableCount).toBe(1);
  });
});

describe("POST /api/me/current-dealership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireUserFromRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
    });
    (prisma.userActiveDealership.findUnique as jest.Mock)?.mockResolvedValue(null);
  });

  it("returns 403 when user is not a member of dealership", async () => {
    (prisma.membership.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await POST(nextRequest({ dealershipId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(body.error?.message).toMatch(/member/);
    expect(setActiveDealershipForUser).not.toHaveBeenCalled();
  });

  it("returns 403 when dealership is CLOSED", async () => {
    (prisma.membership.findFirst as jest.Mock).mockResolvedValue({
      id: "mem-1",
      userId: "user-1",
      dealershipId: "550e8400-e29b-41d4-a716-446655440000",
    });
    (prisma.dealership.findUnique as jest.Mock).mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Closed",
      lifecycleStatus: "CLOSED",
      isActive: false,
    });
    const res = await POST(nextRequest({ dealershipId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(res.status).toBe(403);
    expect(setActiveDealershipForUser).not.toHaveBeenCalled();
  });

  it("returns 200 and updates active dealership when membership valid", async () => {
    (prisma.membership.findFirst as jest.Mock)
      .mockResolvedValueOnce({
        id: "mem-1",
        userId: "user-1",
        dealershipId: "550e8400-e29b-41d4-a716-446655440000",
      })
      .mockResolvedValueOnce({
        role: { key: "sales", name: "Sales" },
      });
    (prisma.dealership.findUnique as jest.Mock).mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Dealership",
      lifecycleStatus: "ACTIVE",
      isActive: true,
    });
    const res = await POST(nextRequest({ dealershipId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(res.status).toBe(200);
    expect(setActiveDealershipForUser).toHaveBeenCalledWith("user-1", "550e8400-e29b-41d4-a716-446655440000");
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.dealership_switched",
        entity: "UserActiveDealership",
        metadata: expect.objectContaining({ newDealershipId: "550e8400-e29b-41d4-a716-446655440000" }),
      })
    );
    const body = await res.json();
    expect(body.data).toMatchObject({
      dealershipId: "550e8400-e29b-41d4-a716-446655440000",
      dealershipName: "Test Dealership",
      roleKey: "sales",
      roleName: "Sales",
    });
  });

  it("returns 422 when dealershipId is not a valid UUID", async () => {
    const res = await POST(nextRequest({ dealershipId: "not-uuid" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });
});
