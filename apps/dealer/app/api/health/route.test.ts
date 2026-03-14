/** @jest-environment node */
jest.mock("@/modules/core-platform/service/health", () => ({
  getHealthResponse: jest.fn(),
}));

import { GET } from "./route";
import * as healthService from "@/modules/core-platform/service/health";

const REQUEST_ID_HEADER = "x-request-id";

describe("GET /api/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (healthService.getHealthResponse as jest.Mock).mockResolvedValue({
      status: 200,
      body: {
        ok: true,
        app: "dealer",
        time: new Date().toISOString(),
        db: "ok",
      },
    });
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
    (healthService.getHealthResponse as jest.Mock).mockResolvedValueOnce({
      status: 503,
      body: {
        ok: false,
        app: "dealer",
        time: new Date().toISOString(),
        db: "error",
        dbError: "Database health check failed",
      },
    });
    const req = new Request("http://localhost/api/health");
    const res = await GET(req as import("next/server").NextRequest);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.dbError).toBe("Database health check failed");
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(JSON.stringify(body)).not.toContain("db.example.com");
  });
});
