/**
 * CRM jobs maintenance auth hardening:
 * GET is cron-secret only; no dealership override from client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const runJobWorkerMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/crm-pipeline-automation/service/job-worker", () => ({
  runJobWorker: runJobWorkerMock,
}));

const prismaMock = vi.hoisted(() => ({
  dealership: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import { GET } from "./route";

describe("GET /api/crm/jobs/run maintenance auth", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";
    prismaMock.dealership.findMany.mockResolvedValue([
      { id: "d0000000-0000-0000-0000-000000000001" },
      { id: "d0000000-0000-0000-0000-000000000002" },
    ]);
    runJobWorkerMock.mockResolvedValue({ processed: 1, failed: 0, deadLetter: 0 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 401 for missing or invalid cron secret", async () => {
    const req = new Request("http://localhost/api/crm/jobs/run", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(prismaMock.dealership.findMany).not.toHaveBeenCalled();
    expect(runJobWorkerMock).not.toHaveBeenCalled();
  });

  it("returns 200 and runs worker for all dealerships with valid cron secret", async () => {
    const req = new Request("http://localhost/api/crm/jobs/run", {
      method: "GET",
      headers: { Authorization: "Bearer cron-secret-123" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(prismaMock.dealership.findMany).toHaveBeenCalledWith({ select: { id: true } });
    expect(runJobWorkerMock).toHaveBeenCalledTimes(2);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(2);
  });
});
