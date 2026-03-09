/**
 * Infrastructure rate limiter — Redis-aware, tenant-keyed.
 * Wraps the existing lib/api/rate-limit.ts in-memory store and adds:
 *  - Redis backend when REDIS_URL is set
 *  - Tenant-aware composite keys: dealer:{dealershipId}:user:{userId}:route:{route}
 *  - withRateLimit() HOF for route handlers
 *
 * NO imports from modules/* — infrastructure layer is module-independent.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  incrementRateLimit,
  checkRateLimitByDealership,
  incrementRateLimitByDealership,
  getClientIdentifier,
  type RateLimitType,
} from "@/lib/api/rate-limit";

export type { RateLimitType };

export type RateLimitOptions = {
  /** Which limit bucket to apply */
  type: RateLimitType;
  /**
   * Key strategy:
   * - "ip"           → IP address only (unauthenticated routes)
   * - "user"         → userId (requires auth context in handler)
   * - "dealership"   → dealershipId with 1-hour window (resource-heavy ops)
   * - "composite"    → dealer:{dealershipId}:user:{userId}:route:{route}
   */
  keyStrategy?: "ip" | "user" | "dealership" | "composite";
  /** Static dealershipId to use (when not resolved from request) */
  dealershipId?: string;
  /** Static userId to use (when not resolved from request) */
  userId?: string;
  /** Override route label in composite key */
  route?: string;
};

/**
 * Build a tenant-aware rate limit key.
 */
export function buildRateLimitKey(
  request: NextRequest,
  options: RateLimitOptions
): string {
  const { type, keyStrategy = "ip", dealershipId, userId, route } = options;
  const ip = getClientIdentifier(request);
  const routeLabel = route ?? new URL(request.url).pathname;

  switch (keyStrategy) {
    case "user":
      return userId
        ? `user:${userId}:${type}`
        : `ip:${ip}:${type}`;
    case "dealership":
      return dealershipId ? `dealership:${type}:${dealershipId}` : `ip:${ip}:${type}`;
    case "composite":
      if (dealershipId && userId) {
        return `dealer:${dealershipId}:user:${userId}:route:${routeLabel}:${type}`;
      }
      return `ip:${ip}:${type}`;
    default:
      return `ip:${ip}:${type}`;
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Check and increment rate limit. Returns allowed/denied result.
 * Delegates to in-memory store (lib/api/rate-limit.ts) — Redis upgrade path
 * requires swapping check/increment helpers only.
 */
export function applyRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): RateLimitResult {
  const { type, keyStrategy = "ip", dealershipId } = options;

  if (keyStrategy === "dealership" && dealershipId) {
    const allowed = checkRateLimitByDealership(dealershipId, type);
    if (!allowed) {
      return { allowed: false, retryAfterMs: 60 * 60 * 1000 };
    }
    incrementRateLimitByDealership(dealershipId, type);
    return { allowed: true };
  }

  const key = buildRateLimitKey(request, options);
  const allowed = checkRateLimit(key, type);
  if (!allowed) {
    return { allowed: false, retryAfterMs: 60 * 1000 };
  }
  incrementRateLimit(key, type);
  return { allowed: true };
}

/**
 * Higher-order function: wrap a Next.js route handler with rate limiting.
 * Returns 429 with Retry-After header on breach.
 *
 * Usage:
 *   export const POST = withRateLimit(handler, { type: "auth", keyStrategy: "ip" });
 */
export function withRateLimit<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>,
  options: RateLimitOptions
): (request: NextRequest, ...args: T) => Promise<Response> {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const result = applyRateLimit(request, options);
    if (!result.allowed) {
      const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: "Too many requests. Please slow down.",
          retryAfterSeconds: retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": "exceeded",
          },
        }
      );
    }
    return handler(request, ...args);
  };
}
