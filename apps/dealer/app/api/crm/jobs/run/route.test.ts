/** @jest-environment node */
/**
 * CRM jobs trigger route:
 * POST enqueues dealership-scoped CRM execution.
 * GET enqueues CRM execution for all dealerships with cron auth.
 */
jest.mock("p-limit", () => ({
  __esModule: true,
  default: () => async <T>(task: () => Promise<T>) => task(),
}));

const mockGetAuthContext = jest.fn();
const mockGuardPermission = jest.fn();
const mockHandleApiError = jest.fn((e: unknown) => {
  const err = e as Error & { code?: string };
  return Response.json(
    { error: { code: err.code ?? "ERROR", message: err.message ?? "Error" } },
    { status: err.name === "ApiError" ? (err as { status?: number }).status ?? 403 : 500 }
  );
});

jest.mock("@/lib/api/handler", () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
  guardPermission: (...args: unknown[]) => mockGuardPermission(...args),
  handleApiError: (e: unknown) => mockHandleApiError(e),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

const mockEnqueueCrmExecution = jest.fn();
jest.mock("@/lib/infrastructure/jobs/enqueueCrmExecution", () => ({
  enqueueCrmExecution: (...args: unknown[]) => mockEnqueueCrmExecution(...args),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    dealership: { findMany: jest.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { GET, POST } from "./route";

describe("POST /api/crm/jobs/run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthContext.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      dealershipId: "d0000000-0000-0000-0000-000000000001",
      permissions: ["crm.write"],
    });
    mockGuardPermission.mockResolvedValue(undefined);
    mockEnqueueCrmExecution.mockResolvedValue({ enqueued: true });
  });

  it("returns 202 and enqueues CRM execution", async () => {
    const req = new Request("http://localhost/api/crm/jobs/run", { method: "POST" });
    const res = await POST(req as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(202);
    expect(mockEnqueueCrmExecution).toHaveBeenCalledWith({
      dealershipId: "d0000000-0000-0000-0000-000000000001",
      source: "manual",
      triggeredByUserId: "user-1",
    });
    await expect(res.json()).resolves.toEqual({ data: { enqueued: true } });
  });

  it("returns 503 when the CRM execution queue is unavailable", async () => {
    mockEnqueueCrmExecution.mockResolvedValueOnce({ enqueued: false, reason: "redis_unavailable" });

    const req = new Request("http://localhost/api/crm/jobs/run", { method: "POST" });
    const res = await POST(req as unknown as import("next/server").NextRequest);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: {
        code: "QUEUE_UNAVAILABLE",
        message: "CRM execution queue unavailable",
        details: { reason: "redis_unavailable" },
      },
    });
  });
});

describe("GET /api/crm/jobs/run maintenance auth", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";
    (prisma.dealership.findMany as jest.Mock).mockResolvedValue([
      { id: "d0000000-0000-0000-0000-000000000001" },
      { id: "d0000000-0000-0000-0000-000000000002" },
    ]);
    mockEnqueueCrmExecution.mockResolvedValue({ enqueued: true });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 401 for missing or invalid cron secret", async () => {
    const req = new Request("http://localhost/api/crm/jobs/run", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(prisma.dealership.findMany).not.toHaveBeenCalled();
    expect(mockEnqueueCrmExecution).not.toHaveBeenCalled();
  });

  it("returns 202 and enqueues CRM execution for all dealerships with valid cron secret", async () => {
    const req = new Request("http://localhost/api/crm/jobs/run", {
      method: "GET",
      headers: { Authorization: "Bearer cron-secret-123" },
    });
    const res = await GET(req);
    expect(res.status).toBe(202);
    expect(prisma.dealership.findMany).toHaveBeenCalledWith({ select: { id: true } });
    expect(mockEnqueueCrmExecution).toHaveBeenCalledTimes(2);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({
      dealershipId: "d0000000-0000-0000-0000-000000000001",
      enqueued: true,
    });
  });

  it("returns 503 when one or more dealership enqueues fail", async () => {
    mockEnqueueCrmExecution
      .mockResolvedValueOnce({ enqueued: true })
      .mockResolvedValueOnce({ enqueued: false, reason: "enqueue_failed" });

    const req = new Request("http://localhost/api/crm/jobs/run", {
      method: "GET",
      headers: { Authorization: "Bearer cron-secret-123" },
    });
    const res = await GET(req);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error?.code).toBe("QUEUE_UNAVAILABLE");
    expect(json.error?.details?.results).toHaveLength(2);
  });
});
