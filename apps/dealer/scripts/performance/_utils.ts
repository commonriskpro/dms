import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { PrismaClient } from "@prisma/client";
import { runWithRequestContext } from "@/lib/request-context";

type ArgMap = Record<string, string | boolean>;

export type PerfDealershipContext = {
  dealershipId: string;
  dealershipSlug: string;
};

export function parseArgs(argv: string[]): ArgMap {
  const out: ArgMap = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

export function readStringArg(
  args: ArgMap,
  key: string,
  fallback: string
): string {
  const value = args[key];
  return typeof value === "string" ? value : fallback;
}

export function readIntArg(args: ArgMap, key: string, fallback: number): number {
  const value = args[key];
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readBoolArg(
  args: ArgMap,
  key: string,
  fallback: boolean
): boolean {
  const value = args[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "1" || value.toLowerCase() === "true") return true;
    if (value === "0" || value.toLowerCase() === "false") return false;
  }
  return fallback;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const raw = (p / 100) * (sorted.length - 1);
  const low = Math.floor(raw);
  const high = Math.ceil(raw);
  if (low === high) return sorted[low];
  const weight = raw - low;
  return sorted[low] + (sorted[high] - sorted[low]) * weight;
}

export function summarizeDurations(values: number[]) {
  if (values.length === 0) {
    return { count: 0, minMs: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 };
  }
  const total = values.reduce((acc, value) => acc + value, 0);
  return {
    count: values.length,
    minMs: Math.min(...values),
    avgMs: Number((total / values.length).toFixed(2)),
    p50Ms: Number(median(values).toFixed(2)),
    p95Ms: Number(percentile(values, 95).toFixed(2)),
    maxMs: Math.max(...values),
  };
}

export function timed<T>(fn: () => Promise<T>): Promise<{ durationMs: number; value: T }> {
  const startedAt = performance.now();
  return fn().then((value) => ({
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    value,
  }));
}

export function runPerfRequest<T>(
  route: string,
  method: string,
  dealershipId: string,
  fn: () => Promise<T>
): Promise<T> {
  return runWithRequestContext(
    {
      requestId: `perf-${randomUUID().slice(0, 12)}`,
      route,
      method,
      dealershipId,
    },
    fn
  );
}

export function printJson(label: string, payload: unknown) {
  console.log(`[perf] ${label}`);
  console.log(JSON.stringify(payload, null, 2));
}

export async function resolveDealershipContext(
  prisma: PrismaClient,
  slug: string
): Promise<PerfDealershipContext> {
  const dealership =
    (await prisma.dealership.findFirst({
      where: { slug },
      select: { id: true, slug: true },
    })) ??
    (await prisma.dealership.findFirst({
      select: { id: true, slug: true },
      orderBy: { createdAt: "asc" },
    }));

  if (!dealership) throw new Error("No dealership found.");

  return {
    dealershipId: dealership.id,
    dealershipSlug: dealership.slug ?? slug,
  };
}

export async function resolveScenarioUserId(
  prisma: PrismaClient,
  dealershipId: string,
  emailPrefix: string
): Promise<string> {
  const membership = await prisma.membership.findFirst({
    where: { dealershipId, disabledAt: null },
    select: { userId: true },
  });

  let userId = membership?.userId ?? null;
  if (userId) {
    const userExists = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) userId = null;
  }

  if (!userId) {
    const profile = await prisma.profile.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    userId = profile?.id ?? null;
  }

  if (!userId) {
    const fallback = await prisma.profile.create({
      data: {
        id: randomUUID(),
        email: `${emailPrefix}-${Date.now()}@local.test`,
        fullName: "Perf Scenario User",
      },
      select: { id: true },
    });
    userId = fallback.id;
  }

  return userId;
}
