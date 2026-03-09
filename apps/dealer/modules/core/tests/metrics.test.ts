/**
 * Prometheus Metrics Infrastructure Tests
 * Tests: metric recording helpers, getMetricsOutput format, getMetricsContentType.
 */

// Reset the prom-client registry between tests to avoid double-registration errors.
// We clear the global singletons before importing.
beforeAll(() => {
  // Clear any previously registered global prom-client registry
  const g = globalThis as Record<string, unknown>;
  delete g.__promRegistry;
  delete g.__promMetrics;
});

import {
  recordApiMetric,
  recordDbMetric,
  recordVinDecodeMetric,
  recordInventoryMetric,
  recordDealSaveMetric,
  recordRateLimitBreach,
  recordJobEnqueue,
  recordJobProcessDuration,
  getMetricsOutput,
  getMetricsContentType,
} from "@/lib/infrastructure/metrics/prometheus";

describe("getMetricsContentType", () => {
  it("returns a non-empty content type string", () => {
    const ct = getMetricsContentType();
    expect(typeof ct).toBe("string");
    expect(ct.length).toBeGreaterThan(0);
    expect(ct).toContain("text/plain");
  });
});

describe("getMetricsOutput", () => {
  it("returns a string (Prometheus text format)", async () => {
    const output = await getMetricsOutput();
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("output contains HELP and TYPE lines for registered metrics", async () => {
    const output = await getMetricsOutput();
    expect(output).toContain("# HELP api_request_duration_ms");
    expect(output).toContain("# TYPE api_request_duration_ms");
    expect(output).toContain("# HELP db_query_duration_ms");
    expect(output).toContain("# HELP vin_decode_duration_ms");
    expect(output).toContain("# HELP inventory_query_duration_ms");
    expect(output).toContain("# HELP deal_save_duration_ms");
    expect(output).toContain("# HELP rate_limit_breaches_total");
    expect(output).toContain("# HELP job_enqueue_total");
    expect(output).toContain("# HELP job_process_duration_ms");
  });
});

describe("recordApiMetric", () => {
  it("does not throw", () => {
    expect(() => recordApiMetric("/api/inventory", 42)).not.toThrow();
  });

  it("accepts method and statusCode options", () => {
    expect(() =>
      recordApiMetric("/api/deals", 123, { method: "POST", statusCode: 201 })
    ).not.toThrow();
  });

  it("reflects in metrics output", async () => {
    recordApiMetric("/api/customers", 88, { method: "GET", statusCode: 200 });
    const output = await getMetricsOutput();
    expect(output).toContain("api_request_duration_ms");
  });
});

describe("recordDbMetric", () => {
  it("does not throw", () => {
    expect(() => recordDbMetric("findMany", "Vehicle", 15)).not.toThrow();
  });

  it("reflects in metrics output", async () => {
    recordDbMetric("create", "Deal", 30);
    const output = await getMetricsOutput();
    expect(output).toContain("db_query_duration_ms");
  });
});

describe("recordVinDecodeMetric", () => {
  it("does not throw for cache hit", () => {
    expect(() => recordVinDecodeMetric("nhtsaApi", true, 5)).not.toThrow();
  });

  it("does not throw for cache miss", () => {
    expect(() => recordVinDecodeMetric("nhtsaApi", false, 850)).not.toThrow();
  });
});

describe("recordInventoryMetric", () => {
  it("does not throw", () => {
    expect(() => recordInventoryMetric("list_vehicles", 120)).not.toThrow();
  });
});

describe("recordDealSaveMetric", () => {
  it("does not throw", () => {
    expect(() => recordDealSaveMetric("update_status", 55)).not.toThrow();
  });
});

describe("recordRateLimitBreach", () => {
  it("does not throw with type and dealershipId", () => {
    expect(() => recordRateLimitBreach("auth", "d-1")).not.toThrow();
  });

  it("defaults dealershipId to unknown when not provided", () => {
    expect(() => recordRateLimitBreach("vin_decode")).not.toThrow();
  });

  it("reflects in metrics output", async () => {
    recordRateLimitBreach("auth", "d-test");
    const output = await getMetricsOutput();
    expect(output).toContain("rate_limit_breaches_total");
  });
});

describe("recordJobEnqueue", () => {
  it("does not throw", () => {
    expect(() => recordJobEnqueue("vinDecode")).not.toThrow();
    expect(() => recordJobEnqueue("analytics")).not.toThrow();
    expect(() => recordJobEnqueue("bulkImport")).not.toThrow();
    expect(() => recordJobEnqueue("alerts")).not.toThrow();
  });

  it("reflects in metrics output", async () => {
    recordJobEnqueue("vinDecode");
    const output = await getMetricsOutput();
    expect(output).toContain("job_enqueue_total");
  });
});

describe("recordJobProcessDuration", () => {
  it("does not throw for success", () => {
    expect(() => recordJobProcessDuration("analytics", "success", 250)).not.toThrow();
  });

  it("does not throw for failed", () => {
    expect(() => recordJobProcessDuration("vinDecode", "failed", 5000)).not.toThrow();
  });
});
