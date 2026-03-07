/** @jest-environment node */
/**
 * PATCH /api/auth/session/switch: tenant isolation — 403 without membership; 200 with membership.
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
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: () => true,
  getClientIdentifier: () => "test-client",
}));
jest.mock("@/lib/tenant", () => ({
  setActiveDealershipForUser: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({
  auditLog: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: jest.fn() },
    dealership: { findUnique: jest.fn() },
    profile: { findUnique: jest.fn() },
    userActiveDealership: { findUnique: jest.fn() },
  },
  __esModule: true,
}));

const mockLoadUserPermissions = jest.fn();
jest.mock("@/lib/rbac", () => ({
  loadUserPermissions: (...args: unknown[]) => mockLoadUserPermissions(...args),
}));

import { requireUserFromRequest, ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PATCH } from "./route";

function nextRequest(body: object): import("next/server").NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("PATCH /api/auth/session/switch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireUserFromRequest as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
    });
    (prisma.userActiveDealership.findUnique as jest.Mock)?.mockResolvedValue(null);
    mockLoadUserPermissions.mockResolvedValue([]);
  });

  it("returns 403 when user has no membership for dealershipId", async () => {
    (prisma.membership.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const req = nextRequest({
      dealershipId: "550e8400-e29b-41d4-a716-446655440000",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(body.error?.message).toMatch(/member/);
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          dealershipId: "550e8400-e29b-41d4-a716-446655440000",
          disabledAt: null,
        },
      })
    );
  });

  it("returns 403 when switching to random UUID (no membership), does not leak existence", async () => {
    (prisma.membership.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const req = nextRequest({
      dealershipId: "00000000-0000-0000-0000-000000000099",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("FORBIDDEN");
  });

  it("returns 200 and sets cookie when user has membership", async () => {
    (prisma.membership.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "mem-1",
      userId: "user-1",
      dealershipId: "550e8400-e29b-41d4-a716-446655440000",
    });
    (prisma.dealership.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Dealership",
      lifecycleStatus: "ACTIVE",
      isActive: true,
    });
    (prisma.profile.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "user-1",
      email: "user@example.com",
      fullName: "User",
      avatarUrl: null,
    });
    const req = nextRequest({
      dealershipId: "550e8400-e29b-41d4-a716-446655440000",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeDealership).toEqual({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Dealership",
    });
  });

  it("returns 403 when dealership is CLOSED or not active", async () => {
    (prisma.membership.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "mem-1",
      userId: "user-1",
      dealershipId: "550e8400-e29b-41d4-a716-446655440000",
    });
    (prisma.dealership.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Closed Store",
      lifecycleStatus: "CLOSED",
      isActive: false,
    });
    const req = nextRequest({
      dealershipId: "550e8400-e29b-41d4-a716-446655440000",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(body.error?.message).toMatch(/not available/);
  });

  it("returns 422 when dealershipId is not a valid UUID", async () => {
    const req = nextRequest({ dealershipId: "not-a-uuid" });
    const res = await PATCH(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });
});
