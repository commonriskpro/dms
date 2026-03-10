type ArgMap = Record<string, string | boolean>;

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
  const startedAt = Date.now();
  return fn().then((value) => ({ durationMs: Date.now() - startedAt, value }));
}

export function printJson(label: string, payload: unknown) {
  console.log(`[perf] ${label}`);
  console.log(JSON.stringify(payload, null, 2));
}

