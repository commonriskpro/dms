import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
const validateEnvMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/env", () => ({ validateEnv: validateEnvMock }));

import { GET } from "./route";

const REQUEST_ID_HEADER = "x-request-id";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateEnvMock.mockReturnValue({ valid: true, missing: [] });
    prismaMock.$queryRaw.mockResolvedValue([{ ok: 1 }]);
  });

  it("response includes x-request-id when not provided", async () => {
    const req = new Request("http://localhost/api/health");
    const res = await GET(req as import("next/server").NextRequest);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
    expect(res.headers.get(REQUEST_ID_HEADER)!.length).toBeGreaterThan(0);
  });

  it("response includes x-request-id from request header when provided", async () => {
    const req = new Request("http://localhost/api/health", {
      headers: { [REQUEST_ID_HEADER]: "my-request-id-456" },
    });
    const res = await GET(req as import("next/server").NextRequest);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("my-request-id-456");
  });

  it("returns sanitized dbError when database ping fails", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED postgres://user:pass@db.example.com:5432/postgres")
    );
    const req = new Request("http://localhost/api/health");
    const res = await GET(req as import("next/server").NextRequest);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.dbError).toBe("Database health check failed");
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("db.example.com");
  });
});
