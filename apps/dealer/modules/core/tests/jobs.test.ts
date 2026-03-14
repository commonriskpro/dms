/**
 * Job Producers Infrastructure Tests
 * Tests: Redis required (throw when REDIS_URL absent or dealershipId missing), enqueue logic, metric recording.
 */

const originalRedisUrl = process.env.REDIS_URL;

beforeAll(() => {
  delete process.env.REDIS_URL;
});

afterAll(() => {
  if (originalRedisUrl) {
    process.env.REDIS_URL = originalRedisUrl;
  } else {
    delete process.env.REDIS_URL;
  }
});

// Mock metrics to avoid prom-client side effects in tests
jest.mock("@/lib/infrastructure/metrics/prometheus", () => ({
  recordJobEnqueue: jest.fn(),
  recordJobProcessDuration: jest.fn(),
  getMetricsOutput: jest.fn().mockResolvedValue("# metrics\n"),
  getMetricsContentType: jest.fn().mockReturnValue("text/plain"),
}));

import { enqueueVinDecode } from "@/lib/infrastructure/jobs/enqueueVinDecode";
import { enqueueBulkImport } from "@/lib/infrastructure/jobs/enqueueBulkImport";
import { enqueueAnalytics, enqueueAlert } from "@/lib/infrastructure/jobs/enqueueAnalytics";
import { enqueueCrmExecution } from "@/lib/infrastructure/jobs/enqueueCrmExecution";
import { recordJobEnqueue } from "@/lib/infrastructure/metrics/prometheus";

const mockRecordJobEnqueue = recordJobEnqueue as jest.MockedFunction<typeof recordJobEnqueue>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// enqueueVinDecode
// ---------------------------------------------------------------------------

describe("enqueueVinDecode — Redis required", () => {
  it("throws when REDIS_URL is absent", async () => {
    await expect(
      enqueueVinDecode({ dealershipId: "d-1", vehicleId: "v-1", vin: "1HGCM82633A004352" })
    ).rejects.toThrow(/REDIS_URL is required/);
  });

  it("throws when dealershipId is missing", async () => {
    await expect(
      enqueueVinDecode({ dealershipId: "", vehicleId: "v-1", vin: "VIN123" })
    ).rejects.toThrow(/Missing dealershipId/);
  });
});

// ---------------------------------------------------------------------------
// enqueueBulkImport
// ---------------------------------------------------------------------------

describe("enqueueBulkImport — Redis required", () => {
  it("throws when REDIS_URL is absent", async () => {
    await expect(
      enqueueBulkImport({
        dealershipId: "d-1",
        importId: "imp-1",
        requestedByUserId: "u-1",
        rowCount: 50,
        rows: [],
      })
    ).rejects.toThrow(/REDIS_URL is required/);
  });

  it("throws when dealershipId is empty", async () => {
    await expect(
      enqueueBulkImport({
        dealershipId: "",
        importId: "imp-4",
        requestedByUserId: "u-1",
        rowCount: 0,
        rows: [],
      })
    ).rejects.toThrow(/Missing dealershipId/);
  });
});

// ---------------------------------------------------------------------------
// enqueueAnalytics
// ---------------------------------------------------------------------------

describe("enqueueAnalytics — Redis required", () => {
  it("throws when REDIS_URL is absent", async () => {
    await expect(
      enqueueAnalytics({ dealershipId: "d-1", type: "inventory_dashboard" })
    ).rejects.toThrow(/REDIS_URL is required/);
  });

  it("throws when dealershipId is empty", async () => {
    await expect(
      enqueueAnalytics({ dealershipId: "", type: "inventory_dashboard" })
    ).rejects.toThrow(/Missing dealershipId/);
  });
});

// ---------------------------------------------------------------------------
// enqueueAlert
// ---------------------------------------------------------------------------

describe("enqueueAlert — Redis required", () => {
  it("throws when REDIS_URL is absent", async () => {
    await expect(
      enqueueAlert({
        dealershipId: "d-1",
        ruleId: "rule-42",
        triggeredAt: new Date().toISOString(),
      })
    ).rejects.toThrow(/REDIS_URL is required/);
  });

  it("throws when dealershipId is empty", async () => {
    await expect(
      enqueueAlert({
        dealershipId: "",
        ruleId: "rule-1",
        triggeredAt: new Date().toISOString(),
      })
    ).rejects.toThrow(/Missing dealershipId/);
  });
});

// ---------------------------------------------------------------------------
// enqueueCrmExecution
// ---------------------------------------------------------------------------

describe("enqueueCrmExecution — queue-only behavior", () => {
  it("returns queue unavailable when REDIS_URL is absent", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      enqueueCrmExecution({ dealershipId: "d-1", source: "manual", triggeredByUserId: "u-1" })
    ).resolves.toEqual({ enqueued: false, reason: "redis_unavailable" });
    expect(mockRecordJobEnqueue).not.toHaveBeenCalledWith("crmExecution");
    consoleSpy.mockRestore();
  });

  it("returns missing_dealership_id when dealershipId is empty", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      enqueueCrmExecution({ dealershipId: "", source: "manual", triggeredByUserId: "u-1" })
    ).resolves.toEqual({ enqueued: false, reason: "missing_dealership_id" });
    expect(mockRecordJobEnqueue).not.toHaveBeenCalledWith("crmExecution");
    consoleSpy.mockRestore();
  });
});
