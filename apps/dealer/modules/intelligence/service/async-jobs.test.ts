jest.mock("@/lib/infrastructure/cache/cacheHelpers", () => ({
  invalidatePrefix: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForWrite: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("./signal-engine", () => ({
  generateInventorySignals: jest.fn().mockResolvedValue({ created: 1, updated: 0, resolved: 0, unchanged: 0 }),
  generateAcquisitionSignals: jest.fn().mockResolvedValue({ created: 2, updated: 0, resolved: 0, unchanged: 0 }),
  generateCrmSignals: jest.fn().mockResolvedValue({ created: 3, updated: 0, resolved: 0, unchanged: 0 }),
  generateDealSignals: jest.fn().mockResolvedValue({ created: 4, updated: 0, resolved: 0, unchanged: 0 }),
  generateOperationSignals: jest.fn().mockResolvedValue({ created: 5, updated: 0, resolved: 0, unchanged: 0 }),
  runSignalEngine: jest.fn().mockResolvedValue({ dealershipId: "d-1" }),
}));

import { invalidatePrefix } from "@/lib/infrastructure/cache/cacheHelpers";
import {
  generateAcquisitionSignals,
  generateCrmSignals,
  generateDealSignals,
  generateInventorySignals,
  generateOperationSignals,
  runSignalEngine,
} from "./signal-engine";
import { runAlertJob, runAnalyticsJob } from "./async-jobs";

describe("async analytics jobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs inventory analytics by invalidating inventory/dashboard caches and refreshing signals", async () => {
    const result = await runAnalyticsJob("d-1", "inventory_dashboard", { vehicleId: "veh-1" });

    expect(invalidatePrefix).toHaveBeenCalledTimes(2);
    expect(generateInventorySignals).toHaveBeenCalledWith("d-1");
    expect(generateAcquisitionSignals).toHaveBeenCalledWith("d-1");
    expect(result.invalidatedPrefixes).toHaveLength(2);
    expect(result.signalRuns).toEqual({
      inventory: { created: 1, updated: 0, resolved: 0, unchanged: 0 },
      acquisition: { created: 2, updated: 0, resolved: 0, unchanged: 0 },
    });
  });

  it("runs alert jobs through the full signal engine", async () => {
    const result = await runAlertJob("d-1", "inventory.stale", "2026-03-09T10:00:00.000Z");

    expect(runSignalEngine).toHaveBeenCalledWith("d-1");
    expect(result.type).toBe("alert_check");
  });

  it("marks unknown analytics types as skipped", async () => {
    const result = await runAnalyticsJob("d-1", "mystery_metric");

    expect(result.skippedReason).toBe("unknown_type");
    expect(generateCrmSignals).not.toHaveBeenCalled();
    expect(generateDealSignals).not.toHaveBeenCalled();
    expect(generateOperationSignals).not.toHaveBeenCalled();
  });
});
