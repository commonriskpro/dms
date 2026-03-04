jest.mock("@/lib/db", () => ({ prisma: { $queryRaw: jest.fn() } }));
jest.mock("@/lib/env", () => ({ validateEnv: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/db";
import { validateEnv } from "@/lib/env";

const REQUEST_ID_HEADER = "x-request-id";

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (validateEnv as jest.Mock).mockReturnValue({ valid: true, missing: [] });
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ok: 1 }]);
  });

  it("response includes x-request-id when not provided", async () => {
    const req = new Request("http://localhost/api/health");
    const res = await GET(req as import("next/server").NextRequest);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
    expect(res.headers.get(REQUEST_ID_HEADER)!.length).toBeGreaterThan(0);
  });

  it("response includes x-request-id from request header when provided", async () => {
    const req = new Request("http://localhost/api/health", {
      headers: { [REQUEST_ID_HEADER]: "my-request-id-123" },
    });
    const res = await GET(req as import("next/server").NextRequest);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("my-request-id-123");
  });
});
