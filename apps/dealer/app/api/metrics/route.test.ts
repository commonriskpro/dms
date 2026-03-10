/** @jest-environment node */
jest.mock("next/cache", () => ({
  unstable_noStore: jest.fn(),
}));
jest.mock("@/lib/operator-access", () => ({
  hasDealerOperatorAccess: jest.fn(),
}));
jest.mock("@/lib/infrastructure/metrics/prometheus", () => ({
  getMetricsOutput: jest.fn(),
  getMetricsContentType: jest.fn(),
}));

import { hasDealerOperatorAccess } from "@/lib/operator-access";
import { getMetricsContentType, getMetricsOutput } from "@/lib/infrastructure/metrics/prometheus";
import { GET } from "./route";

function nextRequest(headers?: Headers): import("next/server").NextRequest {
  return { headers: headers ?? new Headers() } as unknown as import("next/server").NextRequest;
}

describe("GET /api/metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (hasDealerOperatorAccess as jest.Mock).mockResolvedValue(true);
    (getMetricsOutput as jest.Mock).mockResolvedValue("metric 1\n");
    (getMetricsContentType as jest.Mock).mockReturnValue("text/plain");
  });

  it("returns 403 when operator access is missing", async () => {
    (hasDealerOperatorAccess as jest.Mock).mockResolvedValueOnce(false);

    const res = await GET(nextRequest());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: { code: "FORBIDDEN", message: "Operator access required" },
    });
  });

  it("serves metrics when operator access is granted", async () => {
    const res = await GET(nextRequest());

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("metric 1\n");
    expect(res.headers.get("Content-Type")).toBe("text/plain");
  });
});
