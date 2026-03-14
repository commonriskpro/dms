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
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: () => true,
  getClientIdentifier: () => "test-client",
}));
jest.mock("@/modules/core-platform/service/session", () => ({
  getCurrentDealershipSummary: jest.fn(),
  switchActiveDealership: jest.fn(),
}));

import { requireUserFromRequest } from "@/lib/auth";
import { ApiError } from "@/lib/auth";
import * as sessionService from "@/modules/core-platform/service/session";
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
    (sessionService.getCurrentDealershipSummary as jest.Mock).mockResolvedValue({
      data: null,
      availableCount: 2,
    });
    const res = await GET(nextRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toBeNull();
    expect(data.availableCount).toBe(2);
  });

  it("returns current dealership and role when active is set", async () => {
    (sessionService.getCurrentDealershipSummary as jest.Mock).mockResolvedValue({
      data: {
        dealershipId: "deal-1",
        dealershipName: "My Dealership",
        roleKey: "admin",
        roleName: "Admin",
      },
      availableCount: 1,
    });
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
  });

  it("returns 403 when user is not a member of dealership", async () => {
    (sessionService.switchActiveDealership as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Not a member of this dealership")
    );
    const res = await POST(nextRequest({ dealershipId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(body.error?.message).toMatch(/member/);
  });

  it("returns 403 when dealership is CLOSED", async () => {
    (sessionService.switchActiveDealership as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Dealership not available")
    );
    const res = await POST(nextRequest({ dealershipId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(res.status).toBe(403);
  });

  it("returns 200 and updates active dealership when membership valid", async () => {
    (sessionService.switchActiveDealership as jest.Mock).mockResolvedValue({
      dealership: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Dealership",
      },
      role: {
        key: "sales",
        name: "Sales",
      },
    });
    const res = await POST(nextRequest({ dealershipId: "550e8400-e29b-41d4-a716-446655440000" }));
    expect(res.status).toBe(200);
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
