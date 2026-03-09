/**
 * Prometheus metrics registry for the dealer app.
 * Uses prom-client. Metrics are registered once on module load.
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import {
  Registry,
  Histogram,
  Counter,
  collectDefaultMetrics,
} from "prom-client";

// ---------------------------------------------------------------------------
// Registry — single instance, prevents double-registration in Next.js HMR
// ---------------------------------------------------------------------------

const globalForMetrics = globalThis as typeof globalThis & {
  __promRegistry?: Registry;
};

function getRegistry(): Registry {
  if (!globalForMetrics.__promRegistry) {
    const registry = new Registry();
    registry.setDefaultLabels({ app: "dealer" });
    globalForMetrics.__promRegistry = registry;

    // Default Node.js process metrics (CPU, memory, event loop lag).
    // Disabled in test env because setImmediate is unavailable in jsdom.
    if (process.env.NODE_ENV !== "test") {
      collectDefaultMetrics({ register: registry, prefix: "dealer_" });
    }

    registerMetrics(registry);
  }
  return globalForMetrics.__promRegistry;
}

// ---------------------------------------------------------------------------
// Metric instances — lazily registered with the singleton registry
// ---------------------------------------------------------------------------

type MetricInstances = {
  apiRequestDuration: Histogram;
  dbQueryDuration: Histogram;
  vinDecodeDuration: Histogram;
  inventoryQueryDuration: Histogram;
  dealSaveDuration: Histogram;
  rateLimitBreaches: Counter;
  jobEnqueueTotal: Counter;
  jobProcessDuration: Histogram;
  cacheHitsTotal: Counter;
  cacheMissesTotal: Counter;
  cacheInvalidationsTotal: Counter;
};

const globalForInstances = globalThis as typeof globalThis & {
  __promMetrics?: MetricInstances;
};

function registerMetrics(registry: Registry): void {
  if (globalForInstances.__promMetrics) return;

  const apiRequestDuration = new Histogram({
    name: "api_request_duration_ms",
    help: "Duration of API requests in milliseconds",
    labelNames: ["route", "method", "status_code"],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
  });

  const dbQueryDuration = new Histogram({
    name: "db_query_duration_ms",
    help: "Duration of database queries in milliseconds",
    labelNames: ["operation", "model"],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [registry],
  });

  const vinDecodeDuration = new Histogram({
    name: "vin_decode_duration_ms",
    help: "Duration of VIN decode operations in milliseconds",
    labelNames: ["source", "cache_hit"],
    buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
  });

  const inventoryQueryDuration = new Histogram({
    name: "inventory_query_duration_ms",
    help: "Duration of inventory queries in milliseconds",
    labelNames: ["query_type"],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [registry],
  });

  const dealSaveDuration = new Histogram({
    name: "deal_save_duration_ms",
    help: "Duration of deal save operations in milliseconds",
    labelNames: ["operation"],
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [registry],
  });

  const rateLimitBreaches = new Counter({
    name: "rate_limit_breaches_total",
    help: "Total number of rate limit breaches",
    labelNames: ["type", "dealership_id"],
    registers: [registry],
  });

  const jobEnqueueTotal = new Counter({
    name: "job_enqueue_total",
    help: "Total number of jobs enqueued",
    labelNames: ["queue"],
    registers: [registry],
  });

  const jobProcessDuration = new Histogram({
    name: "job_process_duration_ms",
    help: "Duration of job processing in milliseconds",
    labelNames: ["queue", "status"],
    buckets: [10, 50, 100, 250, 500, 1000, 5000, 10000, 30000],
    registers: [registry],
  });

  const cacheHitsTotal = new Counter({
    name: "cache_hits_total",
    help: "Total number of cache hits",
    labelNames: ["resource"],
    registers: [registry],
  });

  const cacheMissesTotal = new Counter({
    name: "cache_misses_total",
    help: "Total number of cache misses",
    labelNames: ["resource"],
    registers: [registry],
  });

  const cacheInvalidationsTotal = new Counter({
    name: "cache_invalidations_total",
    help: "Total number of cache prefix invalidations",
    labelNames: ["resource"],
    registers: [registry],
  });

  globalForInstances.__promMetrics = {
    apiRequestDuration,
    dbQueryDuration,
    vinDecodeDuration,
    inventoryQueryDuration,
    dealSaveDuration,
    rateLimitBreaches,
    jobEnqueueTotal,
    jobProcessDuration,
    cacheHitsTotal,
    cacheMissesTotal,
    cacheInvalidationsTotal,
  };
}

function getMetrics(): MetricInstances {
  const registry = getRegistry();
  if (!globalForInstances.__promMetrics) {
    registerMetrics(registry);
  }
  return globalForInstances.__promMetrics!;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Record an API request duration. Called from route handlers or middleware.
 */
export function recordApiMetric(
  route: string,
  durationMs: number,
  options?: { method?: string; statusCode?: number }
): void {
  getMetrics().apiRequestDuration.observe(
    {
      route,
      method: options?.method ?? "GET",
      status_code: String(options?.statusCode ?? 200),
    },
    durationMs
  );
}

/**
 * Record a database query duration.
 */
export function recordDbMetric(
  operation: string,
  model: string,
  durationMs: number
): void {
  getMetrics().dbQueryDuration.observe({ operation, model }, durationMs);
}

/**
 * Record a VIN decode duration.
 */
export function recordVinDecodeMetric(
  source: string,
  cacheHit: boolean,
  durationMs: number
): void {
  getMetrics().vinDecodeDuration.observe(
    { source, cache_hit: String(cacheHit) },
    durationMs
  );
}

/**
 * Record an inventory query duration.
 */
export function recordInventoryMetric(queryType: string, durationMs: number): void {
  getMetrics().inventoryQueryDuration.observe({ query_type: queryType }, durationMs);
}

/**
 * Record a deal save duration.
 */
export function recordDealSaveMetric(operation: string, durationMs: number): void {
  getMetrics().dealSaveDuration.observe({ operation }, durationMs);
}

/**
 * Increment rate limit breach counter.
 */
export function recordRateLimitBreach(
  type: string,
  dealershipId = "unknown"
): void {
  getMetrics().rateLimitBreaches.inc({ type, dealership_id: dealershipId });
}

/**
 * Increment job enqueue counter.
 */
export function recordJobEnqueue(queue: string): void {
  getMetrics().jobEnqueueTotal.inc({ queue });
}

/**
 * Record job processing duration.
 */
export function recordJobProcessDuration(
  queue: string,
  status: "success" | "failed",
  durationMs: number
): void {
  getMetrics().jobProcessDuration.observe({ queue, status }, durationMs);
}

/**
 * Record a cache hit. Resource is derived from the cache key segment (e.g. "dashboard", "inventory").
 */
export function recordCacheHit(resource: string): void {
  getMetrics().cacheHitsTotal.inc({ resource });
}

/**
 * Record a cache miss.
 */
export function recordCacheMiss(resource: string): void {
  getMetrics().cacheMissesTotal.inc({ resource });
}

/**
 * Record a cache prefix invalidation.
 */
export function recordCacheInvalidation(resource: string): void {
  getMetrics().cacheInvalidationsTotal.inc({ resource });
}

/**
 * Get Prometheus metrics in text format for scraping.
 * Used by GET /api/metrics.
 */
export async function getMetricsOutput(): Promise<string> {
  return getRegistry().metrics();
}

/**
 * Content-Type header value for Prometheus text format.
 */
export function getMetricsContentType(): string {
  return getRegistry().contentType;
}
