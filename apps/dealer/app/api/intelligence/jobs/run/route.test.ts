/** @jest-environment node */
jest.mock("p-limit", () => ({
  __esModule: true,
  default: () => async <T>(task: () => Promise<T>) => task(),
}));

jest.mock("@/modules/intelligence/service/signal-engine", () => ({
  runSignalEngine: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    dealership: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>(
    "@/lib/api/handler"
  );
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardAnyPermission: jest.fn().mockResolvedValue(undefined),
  };
});

import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAuthContext, guardAnyPermission } from "@/lib/api/handler";
import { runSignalEngine } from "@/modules/intelligence/service/signal-engine";
import { GET, POST } from "./route";

const ctx = {
  userId: "u1000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  dealershipId: "d1000000-0000-0000-0000-000000000001",
  permissions: ["deals.read"],
};

describe("POST /api/intelligence/jobs/run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardAnyPermission as jest.Mock).mockResolvedValue(undefined);
    (runSignalEngine as jest.Mock).mockResolvedValue({
      dealershipId: ctx.dealershipId,
      inventory: {},
      crm: {},
      deals: {},
      operations: {},
      acquisition: {},
    });
  });

  it("returns 403 when RBAC check fails", async () => {
    (guardAnyPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = {} as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(runSignalEngine).not.toHaveBeenCalled();
  });

  it("runs engine for authenticated tenant", async () => {
    const req = {} as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(runSignalEngine).toHaveBeenCalledWith(ctx.dealershipId);
  });
});

describe("GET /api/intelligence/jobs/run", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";
    (prisma.dealership.findMany as jest.Mock).mockResolvedValue([
      { id: "d1000000-0000-0000-0000-000000000001" },
      { id: "d1000000-0000-0000-0000-000000000002" },
    ]);
    (runSignalEngine as jest.Mock).mockResolvedValue({
      dealershipId: "d1000000-0000-0000-0000-000000000001",
      inventory: {},
      crm: {},
      deals: {},
      operations: {},
      acquisition: {},
    });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 401 when cron secret is invalid", async () => {
    const req = new Request("http://localhost/api/intelligence/jobs/run", {
      method: "GET",
    });
    const res = await GET(req as unknown as NextRequest);
    expect(res.status).toBe(401);
    expect(prisma.dealership.findMany).not.toHaveBeenCalled();
  });

  it("runs fan-out for all dealerships with valid cron secret", async () => {
    const req = new Request("http://localhost/api/intelligence/jobs/run", {
      method: "GET",
      headers: { Authorization: "Bearer cron-secret-123" },
    });
    const res = await GET(req as unknown as NextRequest);
    expect(res.status).toBe(200);
    expect(prisma.dealership.findMany).toHaveBeenCalledWith({
      select: { id: true },
    });
    expect(runSignalEngine).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
  });
});
