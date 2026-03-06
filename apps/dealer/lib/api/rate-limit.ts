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
const CUSTOMERS_LIST_MAX = 120; // 120 GET list per minute per user+dealership
const CUSTOMERS_CREATE_MAX = 30; // 30 POST create per minute per user+dealership
const CUSTOMERS_MUTATION_MAX = 60; // 60 POST/PATCH (notes, calls, callbacks, last-visit) per minute per user+dealership
const DEALS_MUTATION_MAX = 60; // 60 mutations per minute per user+dealership (status, fees, trade, finance, products)

// Per-dealership, 1-hour window (for inventory/finance abuse prevention)
const DEALERSHIP_HOUR_WINDOW_MS = 60 * 60 * 1000;
const VIN_DECODE_MAX = 30; // 30 per dealership per hour
const VALUATION_REQUEST_MAX = 20; // 20 per dealership per hour
const FLOORPLAN_CURTAILMENT_MAX = 50; // 50 per dealership per hour
const FLOORPLAN_PAYOFF_QUOTE_MAX = 20; // 20 per dealership per hour
const INVENTORY_MUTATION_MAX = 60; // 60 per minute per user+dealership (book-values, recon, floorplan loans)

// Invite flow: limit abuse and token enumeration
const INVITE_CREATE_MAX = 20; // 20 creates per minute per client
const INVITE_RESEND_MAX = 20; // 20 resends per minute per client
const INVITE_ACCEPT_MAX = 10; // 10 accepts per minute per client
const INVITE_RESOLVE_MAX = 60; // 60 resolves per minute per client (limit token probing)

const ADMIN_BACKFILL_MAX = 5; // 5 admin backfill requests per minute per user (conservative)

export type RateLimitType =
  | "auth"
  | "upload"
  | "session_switch"
  | "signed_url"
  | "report_export"
  | "customers_list"
  | "customers_create"
  | "customers_mutation"
  | "deals_mutation"
  | "invite_create"
  | "invite_resend"
  | "invite_accept"
  | "invite_resolve"
  | "vin_decode"
  | "valuation_request"
  | "floorplan_curtailment"
  | "floorplan_payoff_quote"
  | "inventory_mutation"
  | "admin_backfill";

const LIMITS: Record<RateLimitType, number> = {
  auth: AUTH_MAX,
  upload: UPLOAD_MAX,
  session_switch: SESSION_SWITCH_MAX,
  signed_url: SIGNED_URL_MAX,
  report_export: REPORT_EXPORT_MAX,
  customers_list: CUSTOMERS_LIST_MAX,
  customers_create: CUSTOMERS_CREATE_MAX,
  customers_mutation: CUSTOMERS_MUTATION_MAX,
  deals_mutation: DEALS_MUTATION_MAX,
  invite_create: INVITE_CREATE_MAX,
  invite_resend: INVITE_RESEND_MAX,
  invite_accept: INVITE_ACCEPT_MAX,
  invite_resolve: INVITE_RESOLVE_MAX,
  vin_decode: VIN_DECODE_MAX,
  valuation_request: VALUATION_REQUEST_MAX,
  floorplan_curtailment: FLOORPLAN_CURTAILMENT_MAX,
  floorplan_payoff_quote: FLOORPLAN_PAYOFF_QUOTE_MAX,
  inventory_mutation: INVENTORY_MUTATION_MAX,
  admin_backfill: ADMIN_BACKFILL_MAX,
};

/**
 * Returns true if request is allowed, false if rate limited.
 * Call before processing; if true, call incrementRateLimit after success if you want to count.
 * For production, replace this in-memory store with a pluggable backend (e.g. Upstash Redis).
 */
export function checkRateLimit(identifier: string, type: RateLimitType): boolean {
  return check(identifier, LIMITS[type]);
}

/** Per-dealership rate limit with 1-hour window. Key = dealershipId. Used for vin_decode, valuation_request, floorplan_curtailment, floorplan_payoff_quote. */
export function checkRateLimitByDealership(dealershipId: string, type: RateLimitType): boolean {
  const key = `dealership:${type}:${dealershipId}`;
  return check(key, LIMITS[type], DEALERSHIP_HOUR_WINDOW_MS);
}

export function incrementRateLimitByDealership(dealershipId: string, type: RateLimitType): void {
  const key = `dealership:${type}:${dealershipId}`;
  increment(key, LIMITS[type], DEALERSHIP_HOUR_WINDOW_MS);
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
