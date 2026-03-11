/**
 * Server-side env validation for production hardening.
 * Used by GET /api/health to fail fast with a clear message when required vars are missing.
 * Do not import in client components.
 */

import { z } from "zod";

const dealerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  COOKIE_ENCRYPTION_KEY: z.string().min(32, "COOKIE_ENCRYPTION_KEY must be at least 32 chars"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),
  TELEMETRY_RETENTION_DAYS_RATE_LIMIT: z.coerce.number().int().min(1).default(14),
  TELEMETRY_RETENTION_DAYS_JOB_RUNS: z.coerce.number().int().min(1).default(30),
});

const telemetryRetentionSchema = z.object({
  TELEMETRY_RETENTION_DAYS_RATE_LIMIT: z.coerce.number().int().min(1).default(14),
  TELEMETRY_RETENTION_DAYS_JOB_RUNS: z.coerce.number().int().min(1).default(30),
});

type EnvValidationResult = {
  valid: boolean;
  missing: string[];
};

/**
 * Returns which required env vars are missing (empty or undefined).
 * Does not expose values. Call from /api/health or at startup.
 */
export function validateEnv(): EnvValidationResult {
  const result = dealerEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    COOKIE_ENCRYPTION_KEY: process.env.COOKIE_ENCRYPTION_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    TELEMETRY_RETENTION_DAYS_RATE_LIMIT: process.env.TELEMETRY_RETENTION_DAYS_RATE_LIMIT,
    TELEMETRY_RETENTION_DAYS_JOB_RUNS: process.env.TELEMETRY_RETENTION_DAYS_JOB_RUNS,
  });
  if (result.success) {
    return { valid: true, missing: [] };
  }
  const missing = result.error.errors.map((e) => (e.path[0] as string) ?? "unknown");
  return { valid: false, missing: [...new Set(missing)] };
}

type TelemetryRetentionConfig = {
  rateLimitDays: number;
  jobRunsDays: number;
};

/** Returns parsed telemetry retention config with safe defaults. Server-only. */
export function getTelemetryRetentionConfig(): TelemetryRetentionConfig {
  const parsed = telemetryRetentionSchema.parse({
    TELEMETRY_RETENTION_DAYS_RATE_LIMIT: process.env.TELEMETRY_RETENTION_DAYS_RATE_LIMIT,
    TELEMETRY_RETENTION_DAYS_JOB_RUNS: process.env.TELEMETRY_RETENTION_DAYS_JOB_RUNS,
  });

  return {
    rateLimitDays: parsed.TELEMETRY_RETENTION_DAYS_RATE_LIMIT,
    jobRunsDays: parsed.TELEMETRY_RETENTION_DAYS_JOB_RUNS,
  };
}
