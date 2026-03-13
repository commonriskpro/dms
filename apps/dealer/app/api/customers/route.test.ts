/** @jest-environment node */
/**
 * Unit tests for GET/POST /api/customers: rate limiting (429), auth/validation.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  incrementRateLimit: jest.fn(),
}));

jest.mock("@/modules/customers/service/customer", () => ({
  listCustomers: jest.fn(),
  createCustomer: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { checkRateLimit } from "@/lib/api/rate-limit";
import * as customerService from "@/modules/customers/service/customer";
import { ApiError } from "@/lib/auth";
import { GET, POST } from "./route";
import type { NextRequest } from "next/server";

const ctxWithReadWrite = {
  userId: "user-rw",
  email: "rw@test.local",
  dealershipId: "dealer-1",
  permissions: [],
};

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/customers");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return { nextUrl: url, headers: new Headers() } as unknown as NextRequest;
}

function makePostRequest(body: object, opts?: { contentLength?: string }): NextRequest {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (opts?.contentLength) headers.set("content-length", opts.contentLength);
  return {
    nextUrl: new URL("http://localhost/api/customers"),
    json: () => Promise.resolve(body),
    headers,
  } as unknown as NextRequest;
}

describe("GET/POST /api/customers route unit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctxWithReadWrite);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (checkRateLimit as jest.Mock).mockReturnValue(true);
  });

  describe("Rate limit 429", () => {
    it("GET returns 429 when checkRateLimit(customers_list) is false", async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      const req = makeGetRequest({ limit: "25", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error?.code).toBe("RATE_LIMITED");
      expect(checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining("customers:"),
        "customers_list"
      );
    });

    it("POST returns 429 when checkRateLimit(customers_create) is false", async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      const req = makePostRequest({ name: "Test" });
      const res = await POST(req);
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error?.code).toBe("RATE_LIMITED");
      expect(checkRateLimit).toHaveBeenCalledWith(
        expect.stringContaining("customers:"),
        "customers_create"
      );
    });
  });

  describe("GET list", () => {
    it("returns 200 with data and pagination meta when guardPermission passes", async () => {
      (customerService.listCustomers as jest.Mock).mockResolvedValue({
        data: [],
        total: 100,
      });
      const req = makeGetRequest({ limit: "10", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toEqual({ total: 100, limit: 10, offset: 0 });
    });

    it("returns 403 when guardPermission throws FORBIDDEN", async () => {
      (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
      const req = makeGetRequest({ limit: "25", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error?.code).toBe("FORBIDDEN");
      expect(customerService.listCustomers).not.toHaveBeenCalled();
    });

    it("calls listCustomers with dealershipId and pagination meta", async () => {
      (customerService.listCustomers as jest.Mock).mockResolvedValue({ data: [], total: 50 });
      const req = makeGetRequest({ limit: "10", offset: "20" });
      await GET(req);
      expect(customerService.listCustomers).toHaveBeenCalledWith("dealer-1", {
        limit: 10,
        offset: 20,
        filters: { status: undefined, draft: "all", leadSource: undefined, assignedTo: undefined, search: undefined },
        sort: { sortBy: "created_at", sortOrder: "desc" },
      });
    });

    it("calls listCustomers with search filter when search param present", async () => {
      (customerService.listCustomers as jest.Mock).mockResolvedValue({ data: [], total: 0 });
      const req = makeGetRequest({ search: "john@example.com", limit: "25", offset: "0" });
      await GET(req);
      expect(customerService.listCustomers).toHaveBeenCalledWith(
        "dealer-1",
        expect.objectContaining({
          filters: expect.objectContaining({ search: "john@example.com" }),
        })
      );
    });

    it("calls listCustomers with sortBy and sortOrder", async () => {
      (customerService.listCustomers as jest.Mock).mockResolvedValue({ data: [], total: 0 });
      const req = makeGetRequest({ sortBy: "updated_at", sortOrder: "asc", limit: "25", offset: "0" });
      await GET(req);
      expect(customerService.listCustomers).toHaveBeenCalledWith(
        "dealer-1",
        expect.objectContaining({
          sort: { sortBy: "updated_at", sortOrder: "asc" },
        })
      );
    });

    it("returns 400 for invalid sortBy", async () => {
      const req = makeGetRequest({ sortBy: "name", limit: "25", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error?.details ?? data).toBeDefined();
      expect(customerService.listCustomers).not.toHaveBeenCalled();
    });

    it("limit > 100 returns 400", async () => {
      const req = makeGetRequest({ limit: "200", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error?.code).toBe("VALIDATION_ERROR");
      expect(customerService.listCustomers).not.toHaveBeenCalled();
    });
  });

  describe("POST create", () => {
    it("returns 403 when guardPermission throws FORBIDDEN", async () => {
      (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
      const req = makePostRequest({ name: "New Customer" });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error?.code).toBe("FORBIDDEN");
      expect(customerService.createCustomer).not.toHaveBeenCalled();
    });
  });
});
