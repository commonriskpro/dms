import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

type SeedTier = "none" | "small" | "medium" | "large";
type ScenarioName =
  | "reports"
  | "inventory"
  | "dashboard"
  | "worker-burst"
  | "worker-bridge"
  | "platform-bridge";

type ScenarioResult = {
  name: ScenarioName;
  command: string;
  args: string[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number;
  status: "passed" | "failed" | "skipped";
  logFile: string;
  jsonFile: string | null;
  parsedJson: unknown | null;
  reason?: string;
};

type Options = {
  seed: SeedTier;
  dealershipSlug: string;
  dealershipId: string | null;
  bridgeUrl: string | null;
  redisUrl: string | null;
  iterations: number;
  warmup: number;
  artifactsDir: string;
  continueOnError: boolean;
  mutationBursts: number | null;
  workerBurstSize: number | null;
  workerBurstBursts: number | null;
  workerBridgeIterations: number | null;
  platformBridgeIterations: number | null;
  scenarioTimeoutMs: number;
};

function parseArgs(argv: string[]): Options {
  const map = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      map.set(key, true);
      continue;
    }
    map.set(key, next);
    i += 1;
  }

  const seedValue = (map.get("seed") ?? "none").toString();
  if (!["none", "small", "medium", "large"].includes(seedValue)) {
    throw new Error(`Invalid --seed "${seedValue}". Expected none|small|medium|large.`);
  }

  const toInt = (key: string, fallback: number | null): number | null => {
    const raw = map.get(key);
    if (raw == null) return fallback;
    const parsed = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid --${key} value "${String(raw)}".`);
    }
    return parsed;
  };

  const toBool = (key: string, fallback: boolean): boolean => {
    const raw = map.get(key);
    if (raw == null) return fallback;
    if (typeof raw === "boolean") return raw;
    const value = String(raw).toLowerCase();
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    throw new Error(`Invalid --${key} value "${value}". Expected true|false.`);
  };

  return {
    seed: seedValue as SeedTier,
    dealershipSlug: String(map.get("dealership-slug") ?? "demo"),
    dealershipId: map.has("dealership-id") ? String(map.get("dealership-id")) : null,
    bridgeUrl: map.has("bridge-url") ? String(map.get("bridge-url")) : null,
    redisUrl: map.has("redis-url") ? String(map.get("redis-url")) : null,
    iterations: toInt("iterations", 12) ?? 12,
    warmup: toInt("warmup", 2) ?? 2,
    artifactsDir: String(map.get("artifacts-dir") ?? path.join("artifacts", "perf")),
    continueOnError: toBool("continue-on-error", true),
    mutationBursts: toInt("mutation-bursts", null),
    workerBurstSize: toInt("worker-burst-size", null),
    workerBurstBursts: toInt("worker-burst-bursts", null),
    workerBridgeIterations: toInt("worker-bridge-iterations", null),
    platformBridgeIterations: toInt("platform-bridge-iterations", null),
    scenarioTimeoutMs: toInt("scenario-timeout-ms", 600000) ?? 600000,
  };
}

function timestampForPath(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

function extractLastJsonObject(text: string): unknown | null {
  let closeIdx = text.lastIndexOf("}");
  while (closeIdx >= 0) {
    let depth = 0;
    for (let openIdx = closeIdx; openIdx >= 0; openIdx -= 1) {
      const ch = text[openIdx];
      if (ch === "}") depth += 1;
      if (ch === "{") depth -= 1;
      if (depth === 0) {
        const candidate = text.slice(openIdx, closeIdx + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          break;
        }
      }
    }
    closeIdx = text.lastIndexOf("}", closeIdx - 1);
  }
  return null;
}

async function runCommand(
  name: string,
  command: string,
  args: string[],
  runDir: string,
  scenarioTimeoutMs: number
): Promise<ScenarioResult> {
  const logFile = path.join(runDir, `${name}.log`);
  const jsonFile = path.join(runDir, `${name}.json`);
  const startedAt = new Date();
  const started = Date.now();

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  console.log(`[perf:all] running ${name}: ${command} ${args.join(" ")}`);

  const heartbeat = setInterval(() => {
    const elapsed = Date.now() - started;
    console.log(`[perf:all] ${name} still running (${elapsed}ms elapsed)`);
  }, 15000);

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 5000);
  }, scenarioTimeoutMs);

  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text);
  });

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
  clearInterval(heartbeat);
  clearTimeout(timeout);

  const durationMs = Date.now() - started;
  const finishedAt = new Date();
  const parsedJson = extractLastJsonObject(stdout);

  const logPayload = [
    `# Scenario: ${name}`,
    `Started: ${startedAt.toISOString()}`,
    `Finished: ${finishedAt.toISOString()}`,
    `DurationMs: ${durationMs}`,
    `ExitCode: ${exitCode}`,
    `TimedOut: ${timedOut ? "true" : "false"}`,
    `ScenarioTimeoutMs: ${scenarioTimeoutMs}`,
    `Command: ${command} ${args.join(" ")}`,
    "",
    "## STDOUT",
    stdout || "(empty)",
    "",
    "## STDERR",
    stderr || "(empty)",
    "",
  ].join("\n");
  await writeFile(logFile, logPayload, "utf8");

  let resultJsonFile: string | null = null;
  if (parsedJson != null) {
    await writeFile(jsonFile, JSON.stringify(parsedJson, null, 2), "utf8");
    resultJsonFile = jsonFile;
  }

  const parsedStatus =
    parsedJson && typeof parsedJson === "object"
      ? (parsedJson as Record<string, unknown>).status
      : null;
  const parsedReason =
    parsedJson && typeof parsedJson === "object"
      ? (parsedJson as Record<string, unknown>).reason
      : null;
  const derivedStatus: ScenarioResult["status"] =
    parsedStatus === "skipped"
      ? "skipped"
      : exitCode === 0 && !timedOut
        ? "passed"
        : "failed";
  const derivedReason =
    parsedStatus === "skipped"
      ? typeof parsedReason === "string"
        ? parsedReason
        : "Scenario reported skipped status"
      : timedOut
        ? `Timed out after ${scenarioTimeoutMs}ms`
        : undefined;

  return {
    name: name as ScenarioName,
    command,
    args,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    exitCode,
    status: derivedStatus,
    logFile,
    jsonFile: resultJsonFile,
    parsedJson,
    reason: derivedReason,
  };
}

function scenarioMetricSummary(name: ScenarioName, parsedJson: unknown): string {
  if (!parsedJson || typeof parsedJson !== "object") return "No structured metrics parsed";
  const root = parsedJson as Record<string, unknown>;
  const metrics = root.metrics as Record<string, unknown> | undefined;
  if (!metrics) return "No metrics object";

  const getPath = (obj: unknown, pathParts: string[]): unknown =>
    pathParts.reduce<unknown>((acc, part) => {
      if (!acc || typeof acc !== "object") return null;
      return (acc as Record<string, unknown>)[part];
    }, obj);

  const maybeNumber = (value: unknown): string | null =>
    typeof value === "number" ? String(value) : null;

  switch (name) {
    case "reports": {
      const p95 = maybeNumber(getPath(metrics, ["salesSummary", "p95Ms"]));
      return p95 ? `salesSummary p95=${p95}ms` : "reports metrics captured";
    }
    case "inventory": {
      const p95 = maybeNumber(getPath(metrics, ["total", "p95Ms"]));
      return p95 ? `inventory total p95=${p95}ms` : "inventory metrics captured";
    }
    case "dashboard": {
      const p95 = maybeNumber(getPath(metrics, ["dashboardReads", "p95Ms"]));
      const errors = maybeNumber((root as Record<string, unknown>).errorCount);
      return `dashboard p95=${p95 ?? "n/a"}ms errors=${errors ?? "n/a"}`;
    }
    case "worker-burst": {
      const failed = maybeNumber(getPath(metrics, ["crmFailedEnqueueCount"]));
      return `crmFailedEnqueueCount=${failed ?? "n/a"}`;
    }
    case "worker-bridge":
    case "platform-bridge": {
      if ((root as Record<string, unknown>).status === "skipped") {
        const reason = (root as Record<string, unknown>).reason;
        return `skipped: ${typeof reason === "string" ? reason : "bridge unavailable"}`;
      }
      const avg = maybeNumber(getPath(metrics, ["latency", "avgMs"]));
      const errors = maybeNumber(getPath(metrics, ["errorCount"]));
      return `latency avg=${avg ?? "n/a"}ms errors=${errors ?? "n/a"}`;
    }
    default:
      return "metrics captured";
  }
}

function collectScenarioWarnings(result: ScenarioResult): string[] {
  const warnings: string[] = [];
  if (!result.parsedJson || typeof result.parsedJson !== "object") return warnings;
  const root = result.parsedJson as Record<string, unknown>;
  const metrics =
    root.metrics && typeof root.metrics === "object"
      ? (root.metrics as Record<string, unknown>)
      : null;

  const errorCount = root.errorCount;
  if (typeof errorCount === "number" && errorCount > 0) {
    warnings.push(`${result.name}: reported errorCount=${errorCount}`);
  }

  if (result.name === "worker-burst" && metrics) {
    const failedCount = metrics.crmFailedEnqueueCount;
    if (typeof failedCount === "number" && failedCount > 0) {
      warnings.push(`${result.name}: crmFailedEnqueueCount=${failedCount}`);
    }
  }

  return warnings;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.bridgeUrl) {
    process.env.DEALER_INTERNAL_API_URL = options.bridgeUrl;
  }
  if (options.redisUrl) {
    process.env.REDIS_URL = options.redisUrl;
  }

  const startedAt = new Date();
  const runId = timestampForPath(startedAt);
  const runDir = path.resolve(options.artifactsDir, runId);
  await mkdir(runDir, { recursive: true });

  const gitBranch = tryExec("git rev-parse --abbrev-ref HEAD");
  const gitCommit = tryExec("git rev-parse HEAD");
  const nodeVersion = process.version;
  const npmVersion = tryExec("npm --version");
  const preflightWarnings: string[] = [];

  if (!existsSync(path.resolve(".env.local"))) {
    preflightWarnings.push(".env.local missing at repo root");
  }
  if (!existsSync(path.resolve(".env.platform-admin"))) {
    preflightWarnings.push(".env.platform-admin missing at repo root");
  }
  if (!npmVersion) {
    throw new Error("npm command not available.");
  }

  const preflightLines = [
    "# Performance Orchestration Preflight",
    `Started: ${startedAt.toISOString()}`,
    `Run directory: ${runDir}`,
    `Node: ${nodeVersion}`,
    `npm: ${npmVersion}`,
    `Platform: ${os.platform()} ${os.release()}`,
    `Git branch: ${gitBranch ?? "unknown"}`,
    `Git commit: ${gitCommit ?? "unknown"}`,
    `Seed tier: ${options.seed}`,
    `Dealership slug: ${options.dealershipSlug}`,
    `Dealership id: ${options.dealershipId ?? "(auto-resolve from reports if possible)"}`,
    `Bridge URL: ${process.env.DEALER_INTERNAL_API_URL ?? "(default/fallback)"}`,
    `Redis URL: ${process.env.REDIS_URL ?? "(not set)"}`,
    `Iterations: ${options.iterations}`,
    `Warmup: ${options.warmup}`,
    `Continue on error: ${String(options.continueOnError)}`,
    `Worker burst size: ${String(options.workerBurstSize ?? 20)}`,
    `Worker burst bursts: ${String(options.workerBurstBursts ?? 2)}`,
    `Scenario timeout (ms): ${String(options.scenarioTimeoutMs)}`,
    "",
    "Scenarios:",
    "1. reports",
    "2. inventory",
    "3. dashboard",
    "4. worker-burst",
    "5. worker-bridge",
    "6. platform-bridge",
    "",
    "Warnings:",
    ...(preflightWarnings.length > 0 ? preflightWarnings.map((w) => `- ${w}`) : ["- none"]),
    "",
  ];
  await writeFile(path.join(runDir, "preflight.log"), preflightLines.join("\n"), "utf8");
  console.log(preflightLines.join("\n"));

  const results: ScenarioResult[] = [];
  let resolvedDealershipId = options.dealershipId;
  let seedResult: ScenarioResult | null = null;

  if (options.seed !== "none") {
    const seedArgs = [
      "run",
      "perf:seed",
      "--",
      "--tier",
      options.seed,
      "--dealership-slug",
      options.dealershipSlug,
    ];
    seedResult = await runCommand(
      "seed",
      "npm",
      seedArgs,
      runDir,
      options.scenarioTimeoutMs
    );
    if (seedResult.status === "failed" && !options.continueOnError) {
      throw new Error("Seed step failed and --continue-on-error=false.");
    }
  }

  const scenarioSteps: Array<{
    name: ScenarioName;
    args: string[];
    requiresDealershipId?: boolean;
  }> = [
    {
      name: "reports",
      args: [
        "run",
        "perf:reports",
        "--",
        "--dealership-slug",
        options.dealershipSlug,
        "--iterations",
        String(options.iterations),
        "--warmup",
        String(options.warmup),
      ],
    },
    {
      name: "inventory",
      args: [
        "run",
        "perf:inventory",
        "--",
        "--dealership-slug",
        options.dealershipSlug,
        "--iterations",
        String(options.iterations),
        "--warmup",
        String(options.warmup),
      ],
    },
    {
      name: "dashboard",
      args: [
        "run",
        "perf:dashboard",
        "--",
        "--dealership-slug",
        options.dealershipSlug,
        "--iterations",
        String(options.iterations),
        "--warmup",
        String(options.warmup),
        ...(options.mutationBursts != null
          ? ["--mutation-bursts", String(options.mutationBursts)]
          : []),
      ],
    },
    {
      name: "worker-burst",
      args: [
        "run",
        "perf:worker-burst",
        "--",
        "--dealership-slug",
        options.dealershipSlug,
        "--burst-size",
        String(options.workerBurstSize ?? 20),
        "--bursts",
        String(options.workerBurstBursts ?? 2),
      ],
    },
    {
      name: "worker-bridge",
      requiresDealershipId: true,
      args: [
        "run",
        "perf:worker-bridge",
        "--",
      ],
    },
    {
      name: "platform-bridge",
      args: [
        "run",
        "perf:platform-bridge",
        "--",
        "--mode",
        "rate-limits",
        "--iterations",
        String(options.platformBridgeIterations ?? options.iterations),
      ],
    },
  ];

  for (const step of scenarioSteps) {
    if (step.name === "reports" || step.name === "inventory" || step.name === "dashboard") {
      const result = await runCommand(
        step.name,
        "npm",
        step.args,
        runDir,
        options.scenarioTimeoutMs
      );
      results.push(result);
      if (step.name === "reports" && result.parsedJson && !resolvedDealershipId) {
        const parsed = result.parsedJson as Record<string, unknown>;
        const id = parsed.dealershipId;
        if (typeof id === "string" && id.length > 0) {
          resolvedDealershipId = id;
        }
      }
      if (result.status === "failed" && !options.continueOnError) break;
      continue;
    }

    if (step.name === "worker-bridge") {
      if (!resolvedDealershipId) {
        const skipped: ScenarioResult = {
          name: step.name,
          command: "npm",
          args: [],
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          exitCode: 0,
          status: "skipped",
          reason:
            "No dealership id available. Provide --dealership-id or ensure reports scenario returns dealershipId.",
          logFile: path.join(runDir, "worker-bridge.log"),
          jsonFile: null,
          parsedJson: null,
        };
        await writeFile(
          skipped.logFile,
          `Skipped: ${skipped.reason}\n`,
          "utf8"
        );
        results.push(skipped);
        if (!options.continueOnError) break;
        continue;
      }
      const args = [
        ...step.args,
        "--dealership-id",
        resolvedDealershipId,
        "--iterations",
        String(options.workerBridgeIterations ?? options.iterations),
      ];
      const result = await runCommand(
        step.name,
        "npm",
        args,
        runDir,
        options.scenarioTimeoutMs
      );
      results.push(result);
      if (result.status === "failed" && !options.continueOnError) break;
      continue;
    }

    const result = await runCommand(
      step.name,
      "npm",
      step.args,
      runDir,
      options.scenarioTimeoutMs
    );
    results.push(result);
    if (result.status === "failed" && !options.continueOnError) break;
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const failed = results.filter((r) => r.status === "failed");
  const skipped = results.filter((r) => r.status === "skipped");
  const scenarioWarnings = results.flatMap((r) => collectScenarioWarnings(r));

  const summaryJson = {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    status: failed.length > 0 ? "failed" : "passed",
    options,
    seed: seedResult
      ? {
          status: seedResult.status,
          exitCode: seedResult.exitCode,
          durationMs: seedResult.durationMs,
          logFile: path.relative(runDir, seedResult.logFile),
          jsonFile: seedResult.jsonFile
            ? path.relative(runDir, seedResult.jsonFile)
            : null,
        }
      : { status: "skipped" },
    git: { branch: gitBranch, commit: gitCommit },
    environment: {
      nodeVersion,
      npmVersion,
      platform: os.platform(),
      release: os.release(),
    },
    preflightWarnings,
    scenarioWarnings,
    resolvedDealershipId,
    scenarios: results.map((r) => ({
      name: r.name,
      status: r.status,
      exitCode: r.exitCode,
      durationMs: r.durationMs,
      logFile: path.relative(runDir, r.logFile),
      jsonFile: r.jsonFile ? path.relative(runDir, r.jsonFile) : null,
      reason: r.reason ?? null,
      metricSummary: scenarioMetricSummary(r.name, r.parsedJson),
    })),
  };

  const metadataJson = {
    runId,
    createdAt: startedAt.toISOString(),
    artifactsPath: runDir,
    gitBranch,
    gitCommit,
    nodeVersion,
    npmVersion,
    options,
  };

  const summaryMarkdownLines = [
    `# Performance Run Summary`,
    ``,
    `- Run ID: \`${runId}\``,
    `- Started: ${startedAt.toISOString()}`,
    `- Finished: ${finishedAt.toISOString()}`,
    `- Duration: ${durationMs}ms`,
    `- Overall status: **${failed.length > 0 ? "FAILED" : "PASSED"}**`,
    `- Git branch: \`${gitBranch ?? "unknown"}\``,
    `- Git commit: \`${gitCommit ?? "unknown"}\``,
    `- Seed tier: \`${options.seed}\``,
    `- Dealership slug: \`${options.dealershipSlug}\``,
    `- Resolved dealership id: \`${resolvedDealershipId ?? "n/a"}\``,
    ``,
    `## Preflight Warnings`,
    ...(preflightWarnings.length > 0
      ? preflightWarnings.map((w) => `- ${w}`)
      : ["- none"]),
    ``,
    `## Scenario Warnings`,
    ...(scenarioWarnings.length > 0
      ? scenarioWarnings.map((w) => `- ${w}`)
      : ["- none"]),
    ``,
    `## Seed Step`,
    seedResult
      ? `- Status: **${seedResult.status.toUpperCase()}** (exit ${seedResult.exitCode}, ${seedResult.durationMs}ms)`
      : "- Skipped (`--seed none`)",
    seedResult ? `- Log: \`${path.relative(runDir, seedResult.logFile)}\`` : "",
    ``,
    `## Scenario Results`,
    `| Scenario | Status | Exit | Duration (ms) | Metrics | Log |`,
    `|---|---|---:|---:|---|---|`,
    ...results.map(
      (r) =>
        `| ${r.name} | ${r.status} | ${r.exitCode} | ${r.durationMs} | ${scenarioMetricSummary(
          r.name,
          r.parsedJson
        )} | \`${path.relative(runDir, r.logFile)}\` |`
    ),
    ``,
    failed.length > 0 ? `## Failures` : `## Failures`,
    ...(failed.length > 0
      ? failed.map((r) => `- ${r.name}: exit ${r.exitCode}`)
      : ["- none"]),
    ``,
    `## Skipped`,
    ...(skipped.length > 0
      ? skipped.map((r) => `- ${r.name}: ${r.reason ?? "skipped"}`)
      : ["- none"]),
    ``,
    `## Next Actions`,
    ...(failed.length > 0
      ? [
          "1. Inspect the failing scenario log files listed above.",
          "2. Re-run a focused scenario command with the same args from this run.",
          "3. Compare with previous successful run artifacts before changing code.",
        ]
      : [
          "1. Compare this run's summary.json with the previous run for trend changes.",
          "2. If p95/avg regressions appear, open focused optimization tasks by domain.",
        ]),
    "",
  ].filter(Boolean);

  await writeFile(path.join(runDir, "summary.json"), JSON.stringify(summaryJson, null, 2), "utf8");
  await writeFile(path.join(runDir, "metadata.json"), JSON.stringify(metadataJson, null, 2), "utf8");
  await writeFile(path.join(runDir, "summary.md"), summaryMarkdownLines.join("\n"), "utf8");

  console.log(`\n[perf:all] complete`);
  console.log(`Artifacts: ${runDir}`);
  console.log(`Summary: ${path.join(runDir, "summary.md")}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[perf:all] failed", error);
  process.exitCode = 1;
});
