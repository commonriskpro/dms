/**
 * Simple in-memory rate limiter for platform API (onboarding-status, provision, invite-owner).
 * Key = client identifier (IP). No new dependency; same pattern as dealer lib/api/rate-limit.
 */

const store = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;

const ONBOARDING_STATUS_MAX = 120; // light: 120/min per key
const PROVISION_MAX = 20; // moderate
const INVITE_OWNER_MAX = 20; // moderate

function getOrCreate(key: string, max: number): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (entry) {
    if (now >= entry.resetAt) {
      const newEntry = { count: 1, resetAt: now + WINDOW_MS };
      store.set(key, newEntry);
      return newEntry;
    }
    return entry;
  }
  const newEntry = { count: 1, resetAt: now + WINDOW_MS };
  store.set(key, newEntry);
  return newEntry;
}

function check(key: string, max: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return true;
  if (now >= entry.resetAt) {
    store.delete(key);
    return true;
  }
  return entry.count < max;
}

function increment(key: string, max: number): void {
  const entry = getOrCreate(key, max);
  entry.count++;
}

export type PlatformRateLimitType = "onboarding_status" | "provision" | "invite_owner";

const LIMITS: Record<PlatformRateLimitType, number> = {
  onboarding_status: ONBOARDING_STATUS_MAX,
  provision: PROVISION_MAX,
  invite_owner: INVITE_OWNER_MAX,
};

export function getPlatformClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
  return ip ?? "unknown";
}

export function checkPlatformRateLimit(identifier: string, type: PlatformRateLimitType): boolean {
  const key = `platform:${type}:${identifier}`;
  return check(key, LIMITS[type]);
}

export function incrementPlatformRateLimit(identifier: string, type: PlatformRateLimitType): void {
  const key = `platform:${type}:${identifier}`;
  increment(key, LIMITS[type]);
}
