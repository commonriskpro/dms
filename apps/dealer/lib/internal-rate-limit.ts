/**
 * Lightweight rate limit for /api/internal/*.
 * In production: always active; DISABLE_INTERNAL_RATE_LIMIT is ignored and a server error is logged if set.
 * In non-production: disabled when NODE_ENV === "test" or DISABLE_INTERNAL_RATE_LIMIT === "true".
 * Records one event per check (allowed/blocked) for metrics; no-op in test env.
 */

import { recordRateLimitEvent } from "@/lib/rate-limit-events";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const store = new Map<string, { count: number; resetAt: number }>();

/** Key = pathname + IP so each route has its own bucket; not user-controlled. */
function getKey(request: Request): string {
  const pathname = new URL(request.url).pathname;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
  return `${pathname}:${ip ?? "unknown"}`;
}

export function isInternalRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    if (process.env.DISABLE_INTERNAL_RATE_LIMIT === "true") {
      console.error("[internal-rate-limit] DISABLE_INTERNAL_RATE_LIMIT is set in production and will be ignored.");
    }
    return false;
  }
  return process.env.NODE_ENV === "test" || process.env.DISABLE_INTERNAL_RATE_LIMIT === "true";
}

/**
 * Returns null if allowed, or a Response to return (429) if rate limited.
 * Records one row per check (allowed true/false) for metrics; skipped in test env.
 */
export async function checkInternalRateLimit(request: Request): Promise<Response | null> {
  if (isInternalRateLimitDisabled()) return null;
  const key = getKey(request);
  const now = Date.now();
  let entry = store.get(key);
  let allowed: boolean;
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    allowed = true;
  } else {
    entry.count++;
    if (entry.count > MAX_PER_WINDOW) {
      await recordRateLimitEvent(request, false);
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    allowed = true;
  }
  await recordRateLimitEvent(request, allowed);
  return null;
}
