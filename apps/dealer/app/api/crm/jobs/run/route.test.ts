/** @jest-environment node */
/**
 * CRM jobs maintenance auth hardening:
 * GET is cron-secret only; no dealership override from client.
 */
jest.mock("p-limit", () => ({
  __esModule: true,
  default: () => async <T>(task: () => Promise<T>) => task(),
}));

jest.mock("@/modules/crm-pipeline-automation/service/job-worker", () => ({
  runJobWorker: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    dealership: { findMany: jest.fn() },
  },
}));

import { runJobWorker } from "@/modules/crm-pipeline-automation/service/job-worker";
import { prisma } from "@/lib/db";
import { GET } from "./route";

describe("GET /api/crm/jobs/run maintenance auth", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-123";
    (prisma.dealership.findMany as jest.Mock).mockResolvedValue([
      { id: "d0000000-0000-0000-0000-000000000001" },
      { id: "d0000000-0000-0000-0000-000000000002" },
    ]);
    (runJobWorker as jest.Mock).mockResolvedValue({ processed: 1, failed: 0, deadLetter: 0 });
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it("returns 401 for missing or invalid cron secret", async () => {
    const req = new Request("http://localhost/api/crm/jobs/run", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(prisma.dealership.findMany).not.toHaveBeenCalled();
    expect(runJobWorker).not.toHaveBeenCalled();
  });

  it("returns 200 and runs worker for all dealerships with valid cron secret", async () => {
    const req = new Request("http://localhost/api/crm/jobs/run", {
      method: "GET",
      headers: { Authorization: "Bearer cron-secret-123" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(prisma.dealership.findMany).toHaveBeenCalledWith({ select: { id: true } });
    expect(runJobWorker).toHaveBeenCalledTimes(2);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(2);
  });
});
