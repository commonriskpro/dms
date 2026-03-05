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

import { getAuthContext } from "@/lib/api/handler";
import { checkRateLimit } from "@/lib/api/rate-limit";
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
});
