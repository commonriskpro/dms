import { z } from "zod";

const sourceType = z.enum(["TRADE_IN", "AUCTION", "MARKETPLACE", "STREET"]);
const status = z.enum(["DRAFT", "APPROVED", "REJECTED", "PURCHASED", "CONVERTED"]);

/** Non-negative integer string for cents (rejects negative, NaN, non-integer). */
const centsOptional = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (val === undefined || val === null || val === "") return true;
      try {
        const n = BigInt(val);
        return n >= BigInt(0);
      } catch {
        return false;
      }
    },
    { message: "Cents must be a non-negative integer string" }
  );

export const listAppraisalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: status.optional(),
  sourceType: sourceType.optional(),
  vin: z.string().optional(),
  sortBy: z.enum(["createdAt", "expectedRetailCents", "expectedProfitCents"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createAppraisalBodySchema = z.object({
  vin: z.string().min(1).max(17),
  sourceType,
  acquisitionCostCents: centsOptional,
  reconEstimateCents: centsOptional,
  transportEstimateCents: centsOptional,
  feesEstimateCents: centsOptional,
  expectedRetailCents: centsOptional,
  expectedWholesaleCents: centsOptional,
  expectedTradeInCents: centsOptional,
  expectedProfitCents: centsOptional,
  notes: z.string().optional(),
});

export const updateAppraisalBodySchema = createAppraisalBodySchema.partial().omit({ vin: true, sourceType: true });
