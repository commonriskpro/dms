/**
 * Dealer monitoring API contracts. No Prisma/env/side effects.
 */

import { z } from "zod";

const ymdDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (expected YYYY-MM-DD)");

/** Single rate limit snapshot (per routeKey per time bucket) */
export const dealerInternalRateLimitSnapshotSchema = z.object({
  routeKey: z.string(),
  windowStart: z.string().datetime(),
  allowedCount: z.number().int().min(0),
  blockedCount: z.number().int().min(0),
});
export type DealerInternalRateLimitSnapshot = z.infer<typeof dealerInternalRateLimitSnapshotSchema>;

/** Job run event (one row per run) */
export const dealerJobRunEventSchema = z.object({
  runId: z.string().uuid(),
  dealershipId: z.string().uuid(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  processed: z.number().int().min(0),
  failed: z.number().int().min(0),
  deadLetter: z.number().int().min(0),
  skippedReason: z.string().nullable(),
  durationMs: z.number().int().min(0),
});
export type DealerJobRunEvent = z.infer<typeof dealerJobRunEventSchema>;

/** Query for dealer job runs list */
export const dealerJobRunsQuerySchema = z.object({
  dealershipId: z.string().uuid(),
  dateFrom: z.string().refine((v: string) => !Number.isNaN(Date.parse(v)), "Invalid dateFrom"),
  dateTo: z.string().refine((v: string) => !Number.isNaN(Date.parse(v)), "Invalid dateTo"),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});
export type DealerJobRunsQuery = z.infer<typeof dealerJobRunsQuerySchema>;

/** Query for dealer rate limits list */
export const dealerRateLimitsQuerySchema = z.object({
  dateFrom: z.string().refine((v: string) => !Number.isNaN(Date.parse(v)), "Invalid dateFrom"),
  dateTo: z.string().refine((v: string) => !Number.isNaN(Date.parse(v)), "Invalid dateTo"),
  routeKey: z.string().max(500).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});
export type DealerRateLimitsQuery = z.infer<typeof dealerRateLimitsQuerySchema>;

/** Daily rate limit stats row */
export const dealerRateLimitDailyRowSchema = z.object({
  day: ymdDateSchema,
  routeKey: z.string(),
  allowedCount: z.number().int().min(0),
  blockedCount: z.number().int().min(0),
  uniqueIpCountApprox: z.number().int().min(0).nullable(),
});
export type DealerRateLimitDailyRow = z.infer<typeof dealerRateLimitDailyRowSchema>;

/** Query for daily rate limit stats */
export const dealerRateLimitsDailyQuerySchema = z.object({
  dateFrom: ymdDateSchema,
  dateTo: ymdDateSchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type DealerRateLimitsDailyQuery = z.infer<typeof dealerRateLimitsDailyQuerySchema>;

/** Daily dealer job runs row */
export const dealerJobRunDailyRowSchema = z.object({
  day: ymdDateSchema,
  dealershipId: z.string().uuid(),
  totalRuns: z.number().int().min(0),
  skippedRuns: z.number().int().min(0),
  processedRuns: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
  avgDurationMs: z.number().int().min(0),
});
export type DealerJobRunDailyRow = z.infer<typeof dealerJobRunDailyRowSchema>;

/** Query for daily job runs stats */
export const dealerJobRunsDailyQuerySchema = z.object({
  dateFrom: ymdDateSchema,
  dateTo: ymdDateSchema,
  dealershipId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type DealerJobRunsDailyQuery = z.infer<typeof dealerJobRunsDailyQuerySchema>;

/** Monitoring maintenance command */
export const dealerMonitoringMaintenanceRequestSchema = z.object({
  kind: z.enum(["purge", "aggregate", "all"]),
  date: ymdDateSchema.optional(),
});
export type DealerMonitoringMaintenanceRequest = z.infer<typeof dealerMonitoringMaintenanceRequestSchema>;
