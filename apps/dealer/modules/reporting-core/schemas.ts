import { z } from "zod";

const isoDateSchema = z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), {
  message: "Invalid date",
});

const maxYears = 2;
function dateRangeRefine(data: { from: string; to: string }) {
  const from = new Date(data.from);
  const to = new Date(data.to);
  if (from.getTime() > to.getTime()) return false;
  const years = (to.getTime() - from.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return years <= maxYears;
}

export const dealerProfitQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    salespersonId: z.string().uuid().optional().nullable(),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

export const inventoryRoiQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

export const salespersonPerformanceQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });

export const accountingExportQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    accountId: z.string().uuid().optional().nullable(),
    format: z.enum(["csv", "quickbooks"]).default("csv"),
  })
  .refine(dateRangeRefine, { message: "from must be ≤ to; max 2 years range" });
