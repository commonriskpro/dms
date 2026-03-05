/**
 * Slice D: vin-decode-cache service tests.
 * - Invalid VIN throws ApiError INVALID_VIN with fieldErrors.
 * - Cached path: returns cached result without calling fetch.
 * - Miss path: calls fetch (mocked); upserts cache and returns result.
 */
jest.mock("../db/vin-decode-cache", () => ({
  findCached: jest.fn(),
  upsertCache: jest.fn(),
}));
jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
}));

import { decodeVin } from "./vin-decode-cache";
import * as vinDecodeCacheDb from "../db/vin-decode-cache";
import { ApiError } from "@/lib/auth";

const dealershipId = "d1000000-0000-0000-0000-000000000001";

describe("vin-decode-cache decodeVin", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    jest.clearAllMocks();
    (vinDecodeCacheDb.findCached as jest.Mock).mockResolvedValue(null);
    (vinDecodeCacheDb.upsertCache as jest.Mock).mockResolvedValue({});
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws INVALID_VIN with fieldErrors when VIN is wrong length", async () => {
    let err: unknown;
    try {
      await decodeVin(dealershipId, "SHORT");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("INVALID_VIN");
    expect((err as ApiError).details?.fieldErrors?.vin).toBeDefined();
  });

  it("throws INVALID_VIN when VIN contains I, O, or Q", async () => {
    let err: unknown;
    try {
      await decodeVin(dealershipId, "1HGBH41JXMN10918I");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("INVALID_VIN");
  });

  it("returns cached result without calling fetch when cache hit", async () => {
    (vinDecodeCacheDb.findCached as jest.Mock).mockResolvedValue({
      vin: "1HGBH41JXMN109186",
      year: 2020,
      make: "Honda",
      model: "Civic",
      source: "NHTSA",
    });
    globalThis.fetch = jest.fn();
    const result = await decodeVin(dealershipId, "1HGBH41JXMN109186");
    expect(result.cached).toBe(true);
    expect(result.vin).toBe("1HGBH41JXMN109186");
    expect(result.vehicle?.year).toBe(2020);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(vinDecodeCacheDb.upsertCache).not.toHaveBeenCalled();
  });

  it("calls fetch and upserts cache when cache miss", async () => {
    (vinDecodeCacheDb.findCached as jest.Mock).mockResolvedValue(null);
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Count: 1,
        Results: [
          {
            ModelYear: "2020",
            Make: "HONDA",
            Model: "Civic",
            Trim: "EX",
          },
        ],
      }),
    });
    const result = await decodeVin(dealershipId, "1HGBH41JXMN109186");
    expect(result.cached).toBe(false);
    expect(result.source).toBe("NHTSA");
    expect(result.vehicle?.year).toBe(2020);
    expect(result.vehicle?.make).toBe("HONDA");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(vinDecodeCacheDb.upsertCache).toHaveBeenCalledTimes(1);
  });
});
