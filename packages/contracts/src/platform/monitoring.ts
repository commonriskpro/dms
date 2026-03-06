/**
 * Platform monitoring API contracts. No Prisma/env/side effects.
 */

import { z } from "zod";

const ymdDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date (expected YYYY-MM-DD)");

/** Sanitized dealer health response (platform proxy) */
export const platformGetDealerHealthResponseSchema = z.object({
  ok: z.boolean(),
  app: z.string(),
  version: z.string().optional(),
  time: z.string(),
  db: z.string().optional(),
  upstreamStatus: z.number(),
  error: z.string().optional(),
});
export type PlatformGetDealerHealthResponse = z.infer<typeof platformGetDealerHealthResponseSchema>;

/** Query for platform rate limit stats (proxy to dealer) */
export const platformRateLimitStatsQuerySchema = z.object({
  dateFrom: z.string().refine((v: string) => !Number.isNaN(Date.parse(v)), "Invalid dateFrom"),
  dateTo: z.string().refine((v: string) => !Number.isNaN(Date.parse(v)), "Invalid dateTo"),
  routeKey: z.string().max(500).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});
export type PlatformRateLimitStatsQuery = z.infer<typeof platformRateLimitStatsQuerySchema>;

/** Query for platform job runs (proxy to dealer; platformDealershipId or dealer dealershipId) */
export const platformJobRunsQuerySchema = z.object({
  platformDealershipId: z.string().uuid().optional(),
  dealershipId: z.string().uuid().optional(),
  dateFrom: z.string().refine((v: string) => !Number.isNaN(Date.parse(v)), "Invalid dateFrom"),
  dateTo: z.string().refine((v: string) => !Number.isNaN(Date.parse(v)), "Invalid dateTo"),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
}).refine((d: { platformDealershipId?: string | null; dealershipId?: string | null }) => d.platformDealershipId != null || d.dealershipId != null, {
  message: "Either platformDealershipId or dealershipId required",
});
export type PlatformJobRunsQuery = z.infer<typeof platformJobRunsQuerySchema>;

/** Query for platform daily rate-limit stats (proxy to dealer daily endpoint) */
export const platformRateLimitDailyQuerySchema = z.object({
  dateFrom: ymdDateSchema,
  dateTo: ymdDateSchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PlatformRateLimitDailyQuery = z.infer<typeof platformRateLimitDailyQuerySchema>;

/** Daily rate-limit row returned by platform proxy. */
export const platformRateLimitDailyRowSchema = z.object({
  day: ymdDateSchema,
  routeKey: z.string(),
  allowedCount: z.number().int().min(0),
  blockedCount: z.number().int().min(0),
  uniqueIpCountApprox: z.number().int().min(0).nullable(),
});
export type PlatformRateLimitDailyRow = z.infer<typeof platformRateLimitDailyRowSchema>;

/** Query for platform daily job-runs stats (proxy to dealer daily endpoint) */
export const platformJobRunsDailyQuerySchema = z.object({
  dateFrom: ymdDateSchema,
  dateTo: ymdDateSchema,
  dealershipId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PlatformJobRunsDailyQuery = z.infer<typeof platformJobRunsDailyQuerySchema>;

/** Daily job-run row returned by platform proxy. */
export const platformJobRunDailyRowSchema = z.object({
  day: ymdDateSchema,
  dealershipId: z.string().uuid(),
  totalRuns: z.number().int().min(0),
  skippedRuns: z.number().int().min(0),
  processedRuns: z.number().int().min(0),
  failedRuns: z.number().int().min(0),
  avgDurationMs: z.number().int().min(0),
});
export type PlatformJobRunDailyRow = z.infer<typeof platformJobRunDailyRowSchema>;

/** Body for platform maintenance endpoint. */
export const platformMonitoringMaintenanceRequestSchema = z.object({
  kind: z.enum(["purge", "aggregate", "all"]),
  date: ymdDateSchema.optional(),
});
export type PlatformMonitoringMaintenanceRequest = z.infer<
  typeof platformMonitoringMaintenanceRequestSchema
>;

/** Sanitized alert event payload (Slack/email) */
export const platformAlertEventSchema = z.object({
  status: z.enum(["degraded", "outage", "recovered"]),
  upstreamStatus: z.number().optional(),
  platformUrl: z.string().optional(),
  dealerUrl: z.string().optional(),
  requestId: z.string().optional(),
  timestamp: z.string(),
});
export type PlatformAlertEvent = z.infer<typeof platformAlertEventSchema>;
