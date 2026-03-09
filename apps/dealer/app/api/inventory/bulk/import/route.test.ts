/**
 * GET /api/inventory/bulk/import — list bulk import jobs.
 * Tests: valid list, status filter, invalid query 400, forbidden 403, tenant isolation via mock.
 */
jest.mock("@/lib/api/handler", () => ({
  getAuthContext: jest.fn(),
  guardPermission: jest.fn().mockResolvedValue(undefined),
  handleApiError: jest.fn((e: unknown) => {
    const err = e as { statusCode?: number; code?: string; message?: string };
    return Response.json(
      { error: { code: err.code ?? "ERROR", message: err.message ?? "Error" } },
      { status: err.statusCode ?? 500 }
    );
  }),
  jsonResponse: jest.fn((body: unknown) => Response.json(body)),
}));

jest.mock("@/modules/inventory/service/bulk", () => ({
  listBulkImportJobs: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor(
      public code: string,
      message: string
    ) {
      super(message);
      this.name = "ApiError";
      this.statusCode = code === "FORBIDDEN" ? 403 : 500;
    }
  },
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET } from "./route";
import * as bulkService from "@/modules/inventory/service/bulk";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read"],
};

function makeRequest(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/inventory/bulk/import");
  Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  return { nextUrl: url, headers: new Headers() } as unknown as NextRequest;
}

describe("GET /api/inventory/bulk/import", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (bulkService.listBulkImportJobs as jest.Mock).mockResolvedValue({
      data: [
        {
          id: "job-1",
          status: "COMPLETED",
          totalRows: 10,
          processedRows: 10,
          createdAt: "2025-01-01T00:00:00.000Z",
          completedAt: "2025-01-01T00:01:00.000Z",
        },
      ],
      total: 1,
    });
  });

  it("returns 200 with data and meta when query is valid", async () => {
    const res = await GET(makeRequest({ limit: "25", offset: "0" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("job-1");
    expect(body.data[0].status).toBe("COMPLETED");
    expect(body.meta.total).toBe(1);
    expect(body.meta.limit).toBe(25);
    expect(body.meta.offset).toBe(0);
    expect(bulkService.listBulkImportJobs).toHaveBeenCalledWith(ctx.dealershipId, {
      limit: 25,
      offset: 0,
      status: undefined,
    });
  });

  it("passes status filter when provided", async () => {
    await GET(makeRequest({ status: "RUNNING" }));
    expect(bulkService.listBulkImportJobs).toHaveBeenCalledWith(ctx.dealershipId, {
      limit: 25,
      offset: 0,
      status: "RUNNING",
    });
  });

  it("returns 400 when limit is invalid", async () => {
    const res = await GET(makeRequest({ limit: "999" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code ?? data.errors).toBeDefined();
    expect(bulkService.listBulkImportJobs).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
  });
});
