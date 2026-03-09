/**
 * POST /api/inventory/decode-vin:
 * - Invalid VIN returns 400 with fieldErrors.vin and code INVALID_VIN.
 * - Valid VIN calls service (mock: no network); returns 200 with vin, decoded, vehicle, source, cached.
 * - Cached path: service returns cached result (mock); route returns cached: true.
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
  checkRateLimitByDealership: jest.fn().mockReturnValue(true),
  incrementRateLimitByDealership: jest.fn(),
}));
jest.mock("@/modules/inventory/service/vin-decode-cache", () => ({
  decodeVin: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { POST } from "./route";
import * as vinDecodeCacheService from "@/modules/inventory/service/vin-decode-cache";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read", "inventory.write"],
};

function makePostRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
    nextUrl: new URL("http://localhost/api/inventory/decode-vin"),
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("POST /api/inventory/decode-vin", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    const { checkRateLimitByDealership } = await import("@/lib/api/rate-limit");
    (checkRateLimitByDealership as jest.Mock).mockReturnValue(true);
  });

  it("returns 400 with fieldErrors.vin when service throws INVALID_VIN", async () => {
    (vinDecodeCacheService.decodeVin as jest.Mock).mockRejectedValue(
      new ApiError("INVALID_VIN", "Invalid VIN format", {
        fieldErrors: { vin: ["Invalid VIN format"] },
      })
    );
    const req = makePostRequest({ vin: "1HGBH41JXMN10918I" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBe("INVALID_VIN");
    expect(data.error?.details?.fieldErrors?.vin).toBeDefined();
  });

  it("returns 200 with vin, decoded, vehicle, source, cached when service returns result", async () => {
    (vinDecodeCacheService.decodeVin as jest.Mock).mockResolvedValue({
      vin: "1HGBH41JXMN109186",
      decoded: true,
      vehicle: { year: 2020, make: "Honda", model: "Civic" },
      source: "NHTSA",
      cached: false,
    });
    const req = makePostRequest({ vin: "1HGBH41JXMN109186" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data?.vin).toBe("1HGBH41JXMN109186");
    expect(data.data?.decoded).toBe(true);
    expect(data.data?.vehicle?.year).toBe(2020);
    expect(data.data?.source).toBe("NHTSA");
    expect(data.data?.cached).toBe(false);
    expect(vinDecodeCacheService.decodeVin).toHaveBeenCalledWith(ctx.dealershipId, "1HGBH41JXMN109186");
  });

  it("returns 200 with cached: true when service returns cached result", async () => {
    (vinDecodeCacheService.decodeVin as jest.Mock).mockResolvedValue({
      vin: "1HGBH41JXMN109186",
      decoded: true,
      vehicle: { year: 2020, make: "Honda" },
      source: "NHTSA",
      cached: true,
    });
    const req = makePostRequest({ vin: "1HGBH41JXMN109186" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data?.cached).toBe(true);
    expect(vinDecodeCacheService.decodeVin).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when body fails Zod validation (e.g. missing vin)", async () => {
    const req = makePostRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBeDefined();
  });

  it("returns 502 with sanitized message when NHTSA fetch fails (no internal details)", async () => {
    (vinDecodeCacheService.decodeVin as jest.Mock).mockRejectedValue(
      new Error("NHTSA API error: 503 Service Unavailable")
    );
    const req = makePostRequest({ vin: "1HGBH41JXMN109186" });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error?.code).toBe("INTERNAL");
    expect(data.error?.message).toBe("VIN decode service unavailable");
    expect(data.error?.details).toBeUndefined();
  });

  it("returns 429 when rate limit exceeded", async () => {
    const { checkRateLimitByDealership } = await import("@/lib/api/rate-limit");
    (checkRateLimitByDealership as jest.Mock).mockReturnValue(false);
    const req = makePostRequest({ vin: "1HGBH41JXMN109186" });
    const res = await POST(req);
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error?.code).toBe("RATE_LIMITED");
  });

  it("returns 502 with sanitized message when fetch times out (AbortError)", async () => {
    const abortErr = new Error("The operation was aborted.");
    abortErr.name = "AbortError";
    (vinDecodeCacheService.decodeVin as jest.Mock).mockRejectedValue(abortErr);
    const req = makePostRequest({ vin: "1HGBH41JXMN109186" });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error?.message).toBe("VIN decode service unavailable");
    expect(data.error?.details).toBeUndefined();
  });
});
