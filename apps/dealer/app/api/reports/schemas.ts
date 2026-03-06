import { z } from "zod";

const isoDateSchema = z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), {
  message: "Invalid ISO date",
});

const maxYears = 2;
function dateRangeRefine(data: { from: string; to: string }) {
  const from = new Date(data.from);
  const to = new Date(data.to);
  if (from.getTime() > to.getTime()) return false;
  const years = (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years <= maxYears;
}

export const salesSummaryQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    groupBy: z
      .enum(["none", "salesperson", "location", "leadSource"])
      .optional()
      .default("none"),
    timezone: z.string().optional(),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

export const salesByUserQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    timezone: z.string().optional(),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

export const inventoryAgingQuerySchema = z.object({
  asOf: isoDateSchema.optional(),
  timezone: z.string().optional(),
});

export const financePenetrationQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    timezone: z.string().optional(),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

export const mixQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    timezone: z.string().optional(),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

export const pipelineQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    groupBy: z.enum(["day", "week"]).optional(),
    timezone: z.string().optional(),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

export const exportSalesQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    format: z.literal("csv"),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

const vehicleStatusSchema = z.enum([
  "AVAILABLE",
  "HOLD",
  "SOLD",
  "WHOLESALE",
  "REPAIR",
  "ARCHIVED",
]);

export const exportInventoryQuerySchema = z.object({
  asOf: isoDateSchema.optional(),
  format: z.literal("csv"),
  status: vehicleStatusSchema.optional(),
});
