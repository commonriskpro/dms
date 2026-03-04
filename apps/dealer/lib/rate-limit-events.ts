/**
 * Records rate limit check outcomes for metrics. No-op in test env.
 * Uses hashed IP only; never stores raw IP.
 */

import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";

const IPHASH_MAX_LEN = 64;

function getSalt(): string {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.INTERNAL_API_JWT_SECRET;
  if (!salt || salt.length < 16) return "";
  return salt;
}

function hashIp(ip: string): string | null {
  const salt = getSalt();
  if (!salt) return null;
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, IPHASH_MAX_LEN);
}

function getPathname(request: Request): string {
  return new URL(request.url).pathname;
}

function getIpForHash(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() ?? null : null;
  return ip || null;
}

/**
 * Records one rate limit event (allowed or blocked). No-op when NODE_ENV === "test".
 */
export async function recordRateLimitEvent(request: Request, allowed: boolean): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  const routeKey = getPathname(request);
  const ip = getIpForHash(request);
  const ipHash = ip ? hashIp(ip) : null;
  try {
    await prisma.dealerRateLimitEvent.create({
      data: {
        routeKey: routeKey.slice(0, 500),
        allowed,
        ipHash,
      },
    });
  } catch (err) {
    // Do not fail the request; log and drop event
    console.warn("[rate-limit-events] Failed to record event:", err);
  }
}
