/** @jest-environment node */
jest.mock("next/cache", () => ({
  unstable_noStore: jest.fn(),
}));
jest.mock("@/lib/operator-access", () => ({
  hasDealerOperatorAccess: jest.fn(),
}));
jest.mock("@/lib/infrastructure/cache/cacheHelpers", () => ({
  getCacheStats: jest.fn(),
}));

import { hasDealerOperatorAccess } from "@/lib/operator-access";
import { getCacheStats } from "@/lib/infrastructure/cache/cacheHelpers";
import { GET } from "./route";

function nextRequest(headers?: Headers): import("next/server").NextRequest {
  return { headers: headers ?? new Headers() } as unknown as import("next/server").NextRequest;
}

describe("GET /api/cache/stats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (hasDealerOperatorAccess as jest.Mock).mockResolvedValue(true);
    (getCacheStats as jest.Mock).mockReturnValue({
      keysTotal: 4,
      keysByPrefix: { dashboard: 2 },
      hits: 10,
      misses: 1,
    });
  });

  it("returns 403 when operator access is missing", async () => {
    (hasDealerOperatorAccess as jest.Mock).mockResolvedValueOnce(false);

    const res = await GET(nextRequest());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "Operator access required" },
    });
  });

  it("returns cache stats when operator access is granted", async () => {
    const res = await GET(nextRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      keysTotal: 4,
      keysByPrefix: { dashboard: 2 },
      hits: 10,
      misses: 1,
    });
  });
});
