/**
 * Worker -> dealer internal bridge latency scenario.
 *
 * Requires:
 * - DEALER_INTERNAL_API_URL
 * - INTERNAL_API_JWT_SECRET
 */
import { postDealerInternalJob } from "../../src/dealerInternalApi";

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

function summarize(values: number[]) {
  if (values.length === 0) return { count: 0, minMs: 0, avgMs: 0, maxMs: 0 };
  return {
    count: values.length,
    minMs: Math.min(...values),
    avgMs: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
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
  const dealershipId = args["dealership-id"];
  if (!dealershipId) {
    throw new Error("--dealership-id is required");
  }
  const iterations = Number.parseInt(args["iterations"] ?? "20", 10);
  const path = args.path ?? "/api/internal/jobs/analytics";
  const jobType = args["job-type"] ?? "inventory_dashboard";
  const fallbackBaseUrl = "http://localhost:3000";

  if (!process.env.DEALER_INTERNAL_API_URL) {
    process.env.DEALER_INTERNAL_API_URL = fallbackBaseUrl;
  }
  const dealerInternalApiUrl = process.env.DEALER_INTERNAL_API_URL ?? fallbackBaseUrl;

  if (!process.env.INTERNAL_API_JWT_SECRET || process.env.INTERNAL_API_JWT_SECRET.length < 16) {
    console.log(
      JSON.stringify(
        {
          scenario: "worker-bridge",
          status: "skipped",
          reason: "INTERNAL_API_JWT_SECRET missing or too short",
          params: {
            dealershipId,
            iterations,
            path,
            jobType,
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
          scenario: "worker-bridge",
          status: "skipped",
          reason: `DEALER_INTERNAL_API_URL not reachable (${reachability.message ?? "unreachable"})`,
          params: {
            dealershipId,
            iterations,
            path,
            jobType,
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

  const durations: number[] = [];
  const errors: Array<{ iteration: number; message: string }> = [];

  for (let i = 0; i < iterations; i += 1) {
    const body =
      path === "/api/internal/jobs/crm"
        ? {
            dealershipId,
            source: "manual",
            triggeredByUserId: null,
          }
        : {
            dealershipId,
            type: jobType,
            context: { iteration: i, source: "perf-worker-bridge" },
          };

    const startedAt = Date.now();
    try {
      await postDealerInternalJob(path, body);
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
        scenario: "worker-bridge",
        params: {
          dealershipId,
          iterations,
        path,
        jobType,
        dealerInternalApiUrl,
        fallbackUsed: dealerInternalApiUrl === fallbackBaseUrl,
        workerInternalApiProfile: process.env.WORKER_INTERNAL_API_PROFILE === "1",
      },
        metrics: {
          latency: summarize(durations),
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
  console.error("[perf/worker-bridge] failed", error);
  process.exit(1);
});
