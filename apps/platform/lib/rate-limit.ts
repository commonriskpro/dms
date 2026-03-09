/**
 * Minimal in-memory rate limiter for platform auth endpoints.
 * Key = identifier (e.g. IP or userId). Window = 1 min.
 */
const store = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 1000;

const LIMITS: Record<string, number> = {
  password_reset_request: 20,
  email_verification_resend: 10,
  session_revoke: 30,
  invite_owner: 20,
  onboarding_status: 60,
  provision: 10,
};

function check(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return true;
  if (now >= entry.resetAt) {
    store.delete(key);
    return true;
  }
  return entry.count < limit;
}

function increment(key: string, limit: number): void {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count++;
}

export type PlatformRateLimitType =
  | "password_reset_request"
  | "email_verification_resend"
  | "session_revoke"
  | "invite_owner"
  | "onboarding_status"
  | "provision";

export function checkPlatformRateLimit(identifier: string, type: PlatformRateLimitType): boolean {
  return check(identifier, LIMITS[type]);
}

export function incrementPlatformRateLimit(identifier: string, type: PlatformRateLimitType): void {
  increment(identifier, LIMITS[type]);
}

export function getPlatformClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
  return ip ?? "unknown";
}
