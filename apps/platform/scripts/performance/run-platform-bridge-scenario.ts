/**
 * Platform -> dealer internal bridge latency scenario.
 *
 * Requires:
 * - DEALER_INTERNAL_API_URL
 * - INTERNAL_API_JWT_SECRET
 */
import {
  callDealerJobRunsProfile,
  callDealerRateLimitsProfile,
} from "@/lib/call-dealer-internal";

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      out[key] = value;
      i += 1;
    }
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarize(values: number[]) {
  if (values.length === 0) return { count: 0, minMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  return {
    count: values.length,
    minMs: Math.min(...values),
    avgMs: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    p99Ms: percentile(values, 99),
    maxMs: Math.max(...values),
  };
}

async function checkBaseUrlReachable(baseUrl: string): Promise<{ ok: boolean; message?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      signal: controller.signal,
      redirect: "manual",
    });
    return { ok: response.status > 0 };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const iterations = Number.parseInt(args.iterations ?? "20", 10);
  const mode = args.mode ?? "rate-limits";
  const dealershipId = args["dealership-id"];
  const fallbackBaseUrl = "http://localhost:3000";

  if (!process.env.DEALER_INTERNAL_API_URL) {
    process.env.DEALER_INTERNAL_API_URL = fallbackBaseUrl;
  }
  const dealerInternalApiUrl = process.env.DEALER_INTERNAL_API_URL ?? fallbackBaseUrl;

  if (!process.env.INTERNAL_API_JWT_SECRET || process.env.INTERNAL_API_JWT_SECRET.length < 16) {
    console.log(
      JSON.stringify(
        {
          scenario: "platform-bridge",
          status: "skipped",
          reason: "INTERNAL_API_JWT_SECRET missing or too short",
          params: {
            iterations,
            mode,
            dealershipId: dealershipId ?? null,
            dealerInternalApiUrl,
            fallbackUsed: dealerInternalApiUrl === fallbackBaseUrl,
          },
          metrics: {
            latency: summarize([]),
            errorCount: 0,
          },
          sampleErrors: [],
        },
        null,
        2
      )
    );
    return;
  }

  const reachability = await checkBaseUrlReachable(dealerInternalApiUrl);
  if (!reachability.ok) {
    console.log(
      JSON.stringify(
        {
          scenario: "platform-bridge",
          status: "skipped",
          reason: `DEALER_INTERNAL_API_URL not reachable (${reachability.message ?? "unreachable"})`,
          params: {
            iterations,
            mode,
            dealershipId: dealershipId ?? null,
            dealerInternalApiUrl,
            fallbackUsed: dealerInternalApiUrl === fallbackBaseUrl,
          },
          metrics: {
            latency: summarize([]),
            errorCount: 0,
          },
          sampleErrors: [],
        },
        null,
        2
      )
    );
    return;
  }

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - 7 * 24 * 60 * 60 * 1000);

  const durations: number[] = [];
  const setupDurations: number[] = [];
  const signDurations: number[] = [];
  const fetchDurations: number[] = [];
  const parseDurations: number[] = [];
  const handlerDurations: number[] = [];
  const serviceDurations: number[] = [];
  const dbDurations: number[] = [];
  const errors: Array<{ iteration: number; message: string }> = [];

  for (let i = 0; i < iterations; i += 1) {
    const startedAt = Date.now();
    try {
      if (mode === "job-runs") {
        if (!dealershipId) {
          throw new Error("--dealership-id is required for --mode job-runs");
        }
        const result = await callDealerJobRunsProfile(dealershipId, {
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
          limit: 50,
          offset: 0,
        });
        if (!result.ok) throw new Error(result.error.message);
        setupDurations.push(result.profile.setupMs);
        signDurations.push(result.profile.signMs);
        fetchDurations.push(result.profile.fetchMs);
        parseDurations.push(result.profile.parseMs);
        if (typeof result.profile.handlerMs === "number") handlerDurations.push(result.profile.handlerMs);
        if (typeof result.profile.serviceMs === "number") serviceDurations.push(result.profile.serviceMs);
        if (typeof result.profile.dbMs === "number") dbDurations.push(result.profile.dbMs);
      } else {
        const result = await callDealerRateLimitsProfile({
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
          limit: 50,
          offset: 0,
        });
        if (!result.ok) throw new Error(result.error.message);
        setupDurations.push(result.profile.setupMs);
        signDurations.push(result.profile.signMs);
        fetchDurations.push(result.profile.fetchMs);
        parseDurations.push(result.profile.parseMs);
        if (typeof result.profile.handlerMs === "number") handlerDurations.push(result.profile.handlerMs);
        if (typeof result.profile.serviceMs === "number") serviceDurations.push(result.profile.serviceMs);
        if (typeof result.profile.dbMs === "number") dbDurations.push(result.profile.dbMs);
      }
      durations.push(Date.now() - startedAt);
    } catch (error) {
      errors.push({
        iteration: i,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        scenario: "platform-bridge",
        params: {
          iterations,
          mode,
          dealershipId: dealershipId ?? null,
          dealerInternalApiUrl,
          fallbackUsed: dealerInternalApiUrl === fallbackBaseUrl,
          platformDealerBridgeProfile:
            process.env.PLATFORM_DEALER_BRIDGE_PROFILE === "1",
        },
        metrics: {
          latency: summarize(durations),
          segments: {
            setup: summarize(setupDurations),
            signing: summarize(signDurations),
            networkRequest: summarize(fetchDurations),
            responseParse: summarize(parseDurations),
            handlerExecution: summarize(handlerDurations),
            serviceExecution: summarize(serviceDurations),
            dbExecution: summarize(dbDurations),
          },
          errorCount: errors.length,
        },
        sampleErrors: errors.slice(0, 5),
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("[perf/platform-bridge] failed", error);
  process.exit(1);
});
