/**
 * Job Producers Infrastructure Tests
 * Tests: sync fallback (no REDIS_URL), enqueue logic, dealershipId guard, metric recording.
 */

// Ensure no REDIS_URL for fallback tests
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

describe("enqueueVinDecode — sync fallback (no Redis)", () => {
  it("does not throw when REDIS_URL is absent", async () => {
    await expect(
      enqueueVinDecode({ dealershipId: "d-1", vehicleId: "v-1", vin: "1HGCM82633A004352" })
    ).resolves.toBeUndefined();
  });

  it("records job enqueue metric", async () => {
    await enqueueVinDecode({ dealershipId: "d-1", vehicleId: "v-1", vin: "VIN123" });
    expect(mockRecordJobEnqueue).toHaveBeenCalledWith("vinDecode");
  });

  it("logs error and skips when dealershipId is missing", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await enqueueVinDecode({ dealershipId: "", vehicleId: "v-1", vin: "VIN123" });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("dealershipId"));
    expect(mockRecordJobEnqueue).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// enqueueBulkImport
// ---------------------------------------------------------------------------

describe("enqueueBulkImport — sync fallback (no Redis)", () => {
  it("does not throw when REDIS_URL is absent", async () => {
    await expect(
      enqueueBulkImport({
        dealershipId: "d-1",
        importId: "imp-1",
        requestedByUserId: "u-1",
        rowCount: 50,
        rows: [],
      })
    ).resolves.toEqual({ enqueued: false });
  });

  it("calls syncHandler when provided and no Redis", async () => {
    const syncHandler = jest.fn().mockResolvedValue(undefined);
    await enqueueBulkImport(
      {
        dealershipId: "d-1",
        importId: "imp-2",
        requestedByUserId: "u-1",
        rowCount: 5,
        rows: [{ rowNumber: 2, stockNumber: "S-1", vin: "VIN1" }],
      },
      syncHandler
    );
    expect(syncHandler).toHaveBeenCalledTimes(1);
    expect(syncHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        dealershipId: "d-1",
        importId: "imp-2",
        requestedByUserId: "u-1",
        rowCount: 5,
      })
    );
  });

  it("records job enqueue metric", async () => {
    await enqueueBulkImport({
      dealershipId: "d-1",
      importId: "imp-3",
      requestedByUserId: "u-1",
      rowCount: 0,
      rows: [],
    });
    expect(mockRecordJobEnqueue).toHaveBeenCalledWith("bulkImport");
  });

  it("skips when dealershipId is empty", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const syncHandler = jest.fn();
    await enqueueBulkImport(
      {
        dealershipId: "",
        importId: "imp-4",
        requestedByUserId: "u-1",
        rowCount: 0,
        rows: [],
      },
      syncHandler
    );
    expect(syncHandler).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// enqueueAnalytics
// ---------------------------------------------------------------------------

describe("enqueueAnalytics — sync fallback (no Redis)", () => {
  it("does not throw when REDIS_URL is absent", async () => {
    await expect(
      enqueueAnalytics({ dealershipId: "d-1", type: "inventory_dashboard" })
    ).resolves.toBeUndefined();
  });

  it("records job enqueue metric", async () => {
    await enqueueAnalytics({ dealershipId: "d-1", type: "sales_metrics" });
    expect(mockRecordJobEnqueue).toHaveBeenCalledWith("analytics");
  });

  it("accepts optional context", async () => {
    await expect(
      enqueueAnalytics({
        dealershipId: "d-1",
        type: "vin_stats",
        context: { vin: "VIN123", source: "api" },
      })
    ).resolves.toBeUndefined();
    expect(mockRecordJobEnqueue).toHaveBeenCalledWith("analytics");
  });

  it("skips when dealershipId is empty", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    await enqueueAnalytics({ dealershipId: "", type: "inventory_dashboard" });
    expect(mockRecordJobEnqueue).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// enqueueAlert
// ---------------------------------------------------------------------------

describe("enqueueAlert — sync fallback (no Redis)", () => {
  it("does not throw when REDIS_URL is absent", async () => {
    await expect(
      enqueueAlert({
        dealershipId: "d-1",
        ruleId: "rule-42",
        triggeredAt: new Date().toISOString(),
      })
    ).resolves.toBeUndefined();
  });

  it("records job enqueue metric for alerts queue", async () => {
    await enqueueAlert({
      dealershipId: "d-1",
      ruleId: "rule-1",
      triggeredAt: new Date().toISOString(),
    });
    expect(mockRecordJobEnqueue).toHaveBeenCalledWith("alerts");
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
