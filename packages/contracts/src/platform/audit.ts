import { z } from "zod";

/**
 * Platform audit list query params.
 * dateFrom and dateTo are optional ISO date or date-time strings (inclusive range).
 * Pagination: limit/offset.
 */
export const platformAuditQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  actor: z.string().uuid().optional(),
  action: z.string().max(200).optional(),
  targetType: z.string().max(100).optional(),
  targetId: z.string().uuid().optional(),
  dateFrom: z
    .string()
    .optional()
    .refine((v: string | undefined) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
  dateTo: z
    .string()
    .optional()
    .refine((v: string | undefined) => !v || !Number.isNaN(Date.parse(v)), "Invalid date"),
});
export type PlatformAuditQuery = z.infer<typeof platformAuditQuerySchema>;

/** Single audit log entry (API response item) */
export const platformAuditEntrySchema = z.object({
  id: z.string().uuid(),
  actorPlatformUserId: z.string().uuid(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().uuid().nullable(),
  beforeState: z.record(z.unknown()).nullable(),
  afterState: z.record(z.unknown()).nullable(),
  reason: z.string().nullable(),
  requestId: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type PlatformAuditEntry = z.infer<typeof platformAuditEntrySchema>;

/** Audit list response */
export const platformAuditListResponseSchema = z.object({
  data: z.array(platformAuditEntrySchema),
  meta: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  }),
});
export type PlatformAuditListResponse = z.infer<typeof platformAuditListResponseSchema>;
