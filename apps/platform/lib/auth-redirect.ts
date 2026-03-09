import type { NextRequest } from "next/server";
import { logger } from "./logger";

const FALLBACK_BASE_URL = "http://localhost:3001";

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Prefer request origin for redirect continuity and cookie scope.
 * Log mismatches so env drift can be fixed without breaking auth flows.
 */
export function getValidatedAppBaseUrl(request: NextRequest): string {
  const envOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
  const requestOrigin = normalizeOrigin(request.nextUrl?.origin);

  if (envOrigin && requestOrigin && envOrigin !== requestOrigin) {
    logger.warn("auth_redirect_base_mismatch", {
      envAppUrl: envOrigin,
      requestOrigin,
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      recommendation: "Set NEXT_PUBLIC_APP_URL to the active app origin.",
    });
  }

  return requestOrigin ?? envOrigin ?? FALLBACK_BASE_URL;
}

export function getSafeInternalRedirectPath(candidate: string | null | undefined): string {
  if (!candidate) return "/platform";
  if (!candidate.startsWith("/")) return "/platform";
  if (candidate.startsWith("//")) return "/platform";
  return candidate;
}
