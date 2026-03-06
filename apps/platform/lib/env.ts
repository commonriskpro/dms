/**
 * Server-side env validation for production hardening.
 * Used by GET /api/health to fail fast when required vars are missing.
 * Do not import in client components.
 *
 * SUPABASE_SERVICE_ROLE_KEY: Required only for POST /api/platform/users/invite.
 * Validated at runtime when that route is called; not in validateEnv() so the app
 * can start without it. Server-only; never log or expose to client.
 */

import { z } from "zod";

const DEFAULT_PLATFORM_RETENTION_DAYS_MONITORING_EVENTS = 30;
const DEFAULT_PLATFORM_RETENTION_DAYS_AUDIT_LOGS = 3650;

const platformEnvBaseSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DEALER_INTERNAL_API_URL: z.string().url("DEALER_INTERNAL_API_URL must be a valid URL"),
  INTERNAL_API_JWT_SECRET: z.string().min(16, "INTERNAL_API_JWT_SECRET must be at least 16 chars"),
});

const platformEnvEmailSchema = z.object({
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required for owner-invite email"),
  PLATFORM_EMAIL_FROM: z.string().min(1, "PLATFORM_EMAIL_FROM is required (e.g. Platform <noreply@domain.com>)"),
});

const platformEnvSchema = platformEnvBaseSchema.and(platformEnvEmailSchema);

export type EnvValidationResult = {
  valid: boolean;
  missing: string[];
};

/**
 * Validates platform env. In production, email vars (RESEND_API_KEY, PLATFORM_EMAIL_FROM) are required.
 */
export function validateEnv(): EnvValidationResult {
  const base = {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    DEALER_INTERNAL_API_URL: process.env.DEALER_INTERNAL_API_URL,
    INTERNAL_API_JWT_SECRET: process.env.INTERNAL_API_JWT_SECRET,
  };
  const baseResult = platformEnvBaseSchema.safeParse(base);
  if (!baseResult.success) {
    const missing = baseResult.error.errors.map((e) => (e.path[0] as string) ?? "unknown");
    return { valid: false, missing: [...new Set(missing)] };
  }
  if (process.env.NODE_ENV === "production") {
    const emailResult = platformEnvEmailSchema.safeParse({
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      PLATFORM_EMAIL_FROM: process.env.PLATFORM_EMAIL_FROM,
    });
    if (!emailResult.success) {
      const missing = emailResult.error.errors.map((e) => (e.path[0] as string) ?? "unknown");
      return { valid: false, missing: [...new Set(missing)] };
    }
  }
  return { valid: true, missing: [] };
}

/**
 * Throws with a clear message if required env is missing. Server-only.
 */
export function assertEnv(): void {
  const r = validateEnv();
  if (!r.valid) {
    throw new Error(`Missing required env: ${r.missing.join(", ")}`);
  }
}

function parsePositiveIntegerEnv(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

/**
 * DEV-ONLY: When true, enables auth debug logging (server). No tokens/PII logged.
 * Set PLATFORM_AUTH_DEBUG=true to diagnose platform login loop.
 */
export function getPlatformAuthDebug(): boolean {
  const v = process.env.PLATFORM_AUTH_DEBUG;
  return v === "true" || v === "1";
}

/**
 * Retention days for platform monitoring event tables (safe to purge).
 */
export function getPlatformMonitoringEventsRetentionDays(): number {
  return parsePositiveIntegerEnv(
    process.env.PLATFORM_RETENTION_DAYS_MONITORING_EVENTS,
    DEFAULT_PLATFORM_RETENTION_DAYS_MONITORING_EVENTS
  );
}

/**
 * Retention days for platform audit logs. Kept for reporting only.
 * Audit logs remain append-only and are never auto-deleted by retention jobs.
 */
export function getPlatformAuditLogsRetentionDays(): number {
  return parsePositiveIntegerEnv(
    process.env.PLATFORM_RETENTION_DAYS_AUDIT_LOGS,
    DEFAULT_PLATFORM_RETENTION_DAYS_AUDIT_LOGS
  );
}
