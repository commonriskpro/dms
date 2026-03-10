import { z } from "zod";

export const internalBulkImportJobSchema = z.object({
  dealershipId: z.string().uuid(),
  importId: z.string().uuid(),
  requestedByUserId: z.string().uuid(),
  rowCount: z.number().int().min(0).max(500),
  rows: z.array(
    z.object({
      rowNumber: z.number().int().min(2).max(10000),
      stockNumber: z.string().max(100),
      vin: z.string().trim().min(8).max(17).optional(),
      status: z.string().max(32).optional(),
      salePriceCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    })
  ).max(500),
});

export const internalAnalyticsJobSchema = z.object({
  dealershipId: z.string().uuid(),
  type: z.string().min(1).max(100),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const internalAlertJobSchema = z.object({
  dealershipId: z.string().uuid(),
  ruleId: z.string().min(1).max(255),
  triggeredAt: z.string().datetime(),
});

export const internalVinFollowUpJobSchema = z.object({
  dealershipId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  vin: z.string().trim().min(8).max(17),
});

export const internalCrmExecutionJobSchema = z.object({
  dealershipId: z.string().uuid(),
  source: z.enum(["manual", "cron"]).optional(),
  triggeredByUserId: z.string().uuid().nullable().optional(),
});
