/**
 * Infrastructure Rate Limiter Tests
 * Tests: withRateLimit HOF, buildRateLimitKey, applyRateLimit, 429 response shape.
 */

import { NextRequest } from "next/server";

// Mock the underlying rate-limit store
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(() => true),
  incrementRateLimit: jest.fn(),
  checkRateLimitByDealership: jest.fn(() => true),
  incrementRateLimitByDealership: jest.fn(),
  getClientIdentifier: jest.fn(() => "127.0.0.1"),
}));

import {
  withRateLimit,
  buildRateLimitKey,
  applyRateLimit,
} from "@/lib/infrastructure/rate-limit/rateLimit";
import {
  checkRateLimit,
  incrementRateLimit,
  checkRateLimitByDealership,
  incrementRateLimitByDealership,
} from "@/lib/api/rate-limit";

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;
const mockIncrementRateLimit = incrementRateLimit as jest.MockedFunction<typeof incrementRateLimit>;
const mockCheckDealership = checkRateLimitByDealership as jest.MockedFunction<typeof checkRateLimitByDealership>;
const mockIncrementDealership = incrementRateLimitByDealership as jest.MockedFunction<typeof incrementRateLimitByDealership>;

function makeRequest(url = "http://localhost/api/test", headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockReturnValue(true);
  mockCheckDealership.mockReturnValue(true);
});

describe("buildRateLimitKey", () => {
  it("builds ip key by default", () => {
    const req = makeRequest();
    const key = buildRateLimitKey(req, { type: "auth" });
    expect(key).toContain("ip:");
    expect(key).toContain("auth");
  });

  it("builds user key when userId provided", () => {
    const req = makeRequest();
    const key = buildRateLimitKey(req, { type: "auth", keyStrategy: "user", userId: "user-123" });
    expect(key).toBe("user:user-123:auth");
  });

  it("builds dealership key when dealershipId provided", () => {
    const req = makeRequest();
    const key = buildRateLimitKey(req, {
      type: "vin_decode",
      keyStrategy: "dealership",
      dealershipId: "d-456",
    });
    expect(key).toBe("dealership:vin_decode:d-456");
  });

  it("builds composite key when both userId and dealershipId provided", () => {
    const req = makeRequest("http://localhost/api/inventory/vin");
    const key = buildRateLimitKey(req, {
      type: "vin_decode",
      keyStrategy: "composite",
      userId: "user-123",
      dealershipId: "d-456",
    });
    expect(key).toContain("dealer:d-456:user:user-123");
    expect(key).toContain("vin_decode");
  });

  it("falls back to ip key when composite missing userId", () => {
    const req = makeRequest();
    const key = buildRateLimitKey(req, {
      type: "auth",
      keyStrategy: "composite",
    });
    expect(key).toContain("ip:");
  });
});

describe("applyRateLimit — allowed path", () => {
  it("returns allowed:true and increments when under limit", () => {
    mockCheckRateLimit.mockReturnValue(true);
    const req = makeRequest();
    const result = applyRateLimit(req, { type: "auth" });

    expect(result.allowed).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalled();
    expect(mockIncrementRateLimit).toHaveBeenCalled();
  });

  it("uses dealership check for dealership key strategy", () => {
    mockCheckDealership.mockReturnValue(true);
    const req = makeRequest();
    const result = applyRateLimit(req, {
      type: "vin_decode",
      keyStrategy: "dealership",
      dealershipId: "d-789",
    });

    expect(result.allowed).toBe(true);
    expect(mockCheckDealership).toHaveBeenCalledWith("d-789", "vin_decode");
    expect(mockIncrementDealership).toHaveBeenCalledWith("d-789", "vin_decode");
  });
});

describe("applyRateLimit — denied path", () => {
  it("returns allowed:false with retryAfterMs when limit exceeded (ip)", () => {
    mockCheckRateLimit.mockReturnValue(false);
    const req = makeRequest();
    const result = applyRateLimit(req, { type: "auth" });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBe(60 * 1000);
    }
    expect(mockIncrementRateLimit).not.toHaveBeenCalled();
  });

  it("returns allowed:false with 1-hour retryAfterMs for dealership limit", () => {
    mockCheckDealership.mockReturnValue(false);
    const req = makeRequest();
    const result = applyRateLimit(req, {
      type: "vin_decode",
      keyStrategy: "dealership",
      dealershipId: "d-789",
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBe(60 * 60 * 1000);
    }
  });
});

describe("withRateLimit HOF", () => {
  it("calls the handler when rate limit allows", async () => {
    mockCheckRateLimit.mockReturnValue(true);
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withRateLimit(handler, { type: "auth" });

    const req = makeRequest();
    const res = await wrapped(req);

    expect(handler).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withRateLimit(handler, { type: "auth" });

    const req = makeRequest();
    const res = await wrapped(req);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("sets Retry-After header on 429", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const handler = jest.fn(async () => Response.json({ ok: true }));
    const wrapped = withRateLimit(handler, { type: "auth" });

    const res = await wrapped(makeRequest());
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("passes additional args through to the handler", async () => {
    mockCheckRateLimit.mockReturnValue(true);
    const handler = jest.fn(async (_req: NextRequest, ctx: { params: { id: string } }) =>
      Response.json({ id: ctx.params.id })
    );
    const wrapped = withRateLimit(handler, { type: "deals_mutation" });

    const req = makeRequest();
    const ctx = { params: { id: "deal-1" } };
    const res = await wrapped(req, ctx);

    expect(handler).toHaveBeenCalledWith(req, ctx);
    expect(res.status).toBe(200);
  });
});
