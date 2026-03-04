/**
 * GET /api/auth/session: returns activeDealership when set (e.g. after session/switch).
 */
const mockGetSessionContextOrNull = jest.fn();
jest.mock("@/lib/api/handler", () => ({
  getSessionContextOrNull: (...args: unknown[]) => mockGetSessionContextOrNull(...args),
  jsonResponse: (data: unknown, status = 200) =>
    Response.json(data, { status }),
  handleApiError: (e: unknown) => {
    const err = e as Error & { code?: string };
    return Response.json(
      { error: { code: err.code ?? "ERROR", message: err.message ?? "Error" } },
      { status: err.name === "ApiError" ? (err as { status?: number }).status ?? 403 : 500 }
    );
  },
}));

import { GET } from "./route";

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSessionContextOrNull.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 with activeDealership when session has active dealership (e.g. after switch)", async () => {
    mockGetSessionContextOrNull.mockResolvedValueOnce({
      userId: "user-1",
      email: "user@example.com",
      fullName: "User",
      avatarUrl: null,
      activeDealershipId: "550e8400-e29b-41d4-a716-446655440000",
      activeDealership: { id: "550e8400-e29b-41d4-a716-446655440000", name: "Test Dealership" },
      lifecycleStatus: "ACTIVE",
      lastStatusReason: null,
      closedDealership: null,
      permissions: ["customers.read"],
      platformAdmin: { isAdmin: false },
      pendingApproval: false,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeDealership).toEqual({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Test Dealership",
    });
    expect(body.user).toBeDefined();
    expect(body.permissions).toEqual(["customers.read"]);
  });
});
