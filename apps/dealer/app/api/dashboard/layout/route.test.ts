/**
 * POST /api/dashboard/layout: validation (duplicate widget ids → 400), auth (403 when no permission).
 */
jest.mock("@/lib/api/handler", () => ({
  getAuthContext: jest.fn(),
  guardPermission: jest.fn().mockResolvedValue(undefined),
  getRequestMeta: jest.fn().mockReturnValue({}),
  handleApiError: jest.fn((e: unknown) => {
    const err = e as { code?: string; status?: number; body?: unknown };
    if (err?.code === "FORBIDDEN") return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    if (err?.status && err?.body) return Response.json(err.body, { status: err.status });
    return Response.json({ error: "Unknown" }, { status: 500 });
  }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/modules/dashboard/service/dashboard-layout-persistence", () => ({
  saveLayout: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/auth", () => ({
  ApiError: class ApiError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { POST } from "./route";

const ctx = {
  userId: "660e8400-e29b-41d4-a716-446655440000",
  email: "u@test.local",
  dealershipId: "550e8400-e29b-41d4-a716-446655440000",
  permissions: ["dashboard.read", "inventory.read", "crm.read", "customers.read"],
};

describe("POST /api/dashboard/layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 400 when body has duplicate widget ids", async () => {
    const body = {
      version: 1,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow", order: 0 },
        { widgetId: "metrics-inventory", visible: false, zone: "topRow", order: 1 },
      ],
    };
    const request = new Request("http://localhost/api/dashboard/layout", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const body = {
      version: 1,
      widgets: [{ widgetId: "metrics-inventory", visible: true, zone: "topRow", order: 0 }],
    };
    const request = new Request("http://localhost/api/dashboard/layout", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request as import("next/server").NextRequest);
    expect(res.status).toBe(403);
  });

  it("returns 200 and data when valid payload and auth", async () => {
    const body = {
      version: 1,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow", order: 0 },
        { widgetId: "customer-tasks", visible: true, zone: "main", order: 0 },
      ],
    };
    const request = new Request("http://localhost/api/dashboard/layout", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(request as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data?.ok).toBe(true);
    expect(Array.isArray(data.data?.layout)).toBe(true);
  });
});
