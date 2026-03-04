import { createHash } from "crypto";

/**
 * Simple in-memory rate limiter for auth and file upload endpoints.
 * Key = identifier (e.g. IP or userId). Window = seconds. Max = requests per window.
 * For production, replace with Upstash Redis or similar (pluggable).
 */
const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const AUTH_MAX = 20; // 20 auth attempts per minute per key
const UPLOAD_MAX = 10; // 10 uploads per minute per key
const SESSION_SWITCH_MAX = 30; // 30 switches per minute per key
const SIGNED_URL_MAX = 60; // 60 signed URL requests per minute per key (optional)

const INVITE_ACCEPT_TOKEN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const INVITE_ACCEPT_TOKEN_MAX = 5;

function getOrCreate(
  key: string,
  max: number,
  windowMs: number = WINDOW_MS
): { count: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);
  if (entry) {
    if (now >= entry.resetAt) {
      const newEntry = { count: 1, resetAt: now + windowMs };
      store.set(key, newEntry);
      return newEntry;
    }
    return entry;
  }
  const newEntry = { count: 1, resetAt: now + windowMs };
  store.set(key, newEntry);
  return newEntry;
}

function check(key: string, max: number, windowMs: number = WINDOW_MS): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry) return true;
  if (now >= entry.resetAt) {
    store.delete(key);
    return true;
  }
  return entry.count < max;
}

function increment(key: string, max: number, windowMs: number = WINDOW_MS): void {
  const entry = getOrCreate(key, max, windowMs);
  entry.count++;
}

const REPORT_EXPORT_MAX = 10; // 10 report exports per minute per key

// Invite flow: limit abuse and token enumeration
const INVITE_CREATE_MAX = 20; // 20 creates per minute per client
const INVITE_RESEND_MAX = 20; // 20 resends per minute per client
const INVITE_ACCEPT_MAX = 10; // 10 accepts per minute per client
const INVITE_RESOLVE_MAX = 60; // 60 resolves per minute per client (limit token probing)

export type RateLimitType =
  | "auth"
  | "upload"
  | "session_switch"
  | "signed_url"
  | "report_export"
  | "invite_create"
  | "invite_resend"
  | "invite_accept"
  | "invite_resolve";

const LIMITS: Record<RateLimitType, number> = {
  auth: AUTH_MAX,
  upload: UPLOAD_MAX,
  session_switch: SESSION_SWITCH_MAX,
  signed_url: SIGNED_URL_MAX,
  report_export: REPORT_EXPORT_MAX,
  invite_create: INVITE_CREATE_MAX,
  invite_resend: INVITE_RESEND_MAX,
  invite_accept: INVITE_ACCEPT_MAX,
  invite_resolve: INVITE_RESOLVE_MAX,
};

/**
 * Returns true if request is allowed, false if rate limited.
 * Call before processing; if true, call incrementRateLimit after success if you want to count.
 * For production, replace this in-memory store with a pluggable backend (e.g. Upstash Redis).
 */
export function checkRateLimit(identifier: string, type: RateLimitType): boolean {
  return check(identifier, LIMITS[type]);
}

export function incrementRateLimit(identifier: string, type: RateLimitType): void {
  increment(identifier, LIMITS[type]);
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
  return ip ?? "unknown";
}

/** Per-token rate limit for invite accept (signup path). Key = hash of token so token is never stored. */
export function getInviteAcceptTokenRateLimitKey(token: string): string {
  const hash = createHash("sha256").update(token).digest("hex");
  return `invite_accept_token:${hash}`;
}

export function checkRateLimitInviteAcceptPerToken(token: string): boolean {
  const key = getInviteAcceptTokenRateLimitKey(token);
  return check(key, INVITE_ACCEPT_TOKEN_MAX, INVITE_ACCEPT_TOKEN_WINDOW_MS);
}

export function incrementRateLimitInviteAcceptPerToken(token: string): void {
  const key = getInviteAcceptTokenRateLimitKey(token);
  increment(key, INVITE_ACCEPT_TOKEN_MAX, INVITE_ACCEPT_TOKEN_WINDOW_MS);
}
