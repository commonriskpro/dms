import { z } from "zod";

const dealStatusSchema = z.enum(["DRAFT", "STRUCTURED", "APPROVED", "CONTRACTED", "CANCELED"]);

/** Coerce string or number to BigInt (cents). */
const centsSchema = z.union([z.string(), z.number()]).transform((v) => {
  const s = String(v).trim();
  const n = BigInt(s);
  if (n < BigInt(0)) throw new Error("Cents must be non-negative");
  return n;
});

export const listDealsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: dealStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "frontGrossCents", "status", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createDealBodySchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  salePriceCents: centsSchema,
  purchasePriceCents: centsSchema,
  taxRateBps: z.number().int().min(0).max(10000),
  docFeeCents: centsSchema.optional().transform((v) => (v === undefined ? BigInt(0) : v)),
  downPaymentCents: centsSchema.optional().transform((v) => (v === undefined ? BigInt(0) : v)),
  notes: z.string().max(5000).optional(),
  fees: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        amountCents: centsSchema,
        taxable: z.boolean().optional(),
      })
    )
    .optional(),
});

export const updateDealBodySchema = z.object({
  salePriceCents: centsSchema.optional(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  docFeeCents: centsSchema.optional(),
  downPaymentCents: centsSchema.optional(),
  notes: z.string().max(5000).optional().nullable(),
});

export const dealIdParamSchema = z.object({ id: z.string().uuid() });

export const createDealFeeBodySchema = z.object({
  label: z.string().min(1).max(200),
  amountCents: centsSchema,
  taxable: z.boolean().optional(),
});

export const updateDealFeeBodySchema = z.object({
  label: z.string().min(1).max(200).optional(),
  amountCents: centsSchema.optional(),
  taxable: z.boolean().optional(),
});

export const dealIdFeeIdParamSchema = z.object({
  id: z.string().uuid(),
  feeId: z.string().uuid(),
});

export const createDealTradeBodySchema = z.object({
  vehicleDescription: z.string().min(1).max(500),
  allowanceCents: centsSchema,
  payoffCents: centsSchema.optional().transform((v) => (v === undefined ? BigInt(0) : v)),
});

export const updateDealTradeBodySchema = z.object({
  vehicleDescription: z.string().min(1).max(500).optional(),
  allowanceCents: centsSchema.optional(),
  payoffCents: centsSchema.optional(),
});

export const dealIdTradeIdParamSchema = z.object({
  id: z.string().uuid(),
  tradeId: z.string().uuid(),
});

export const listDealTradesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const updateDealStatusBodySchema = z.object({
  status: dealStatusSchema,
});

export const listDealHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// --- Finance shell (docs/design/finance-shell-spec.md) ---
const financingModeSchema = z.enum(["CASH", "FINANCE"]);
const dealFinanceStatusSchema = z.enum([
  "DRAFT",
  "STRUCTURED",
  "PRESENTED",
  "ACCEPTED",
  "CONTRACTED",
  "CANCELED",
]);
const dealFinanceProductTypeSchema = z.enum([
  "GAP",
  "VSC",
  "MAINTENANCE",
  "TIRE_WHEEL",
  "OTHER",
]);

export const putFinanceBodySchema = z.object({
  financingMode: financingModeSchema,
  termMonths: z.number().int().min(1).max(84).optional().nullable(),
  aprBps: z.number().int().min(0).optional().nullable(),
  cashDownCents: centsSchema.optional(),
  amountFinancedCents: centsSchema.optional(),
  monthlyPaymentCents: centsSchema.optional(),
  totalOfPaymentsCents: centsSchema.optional(),
  financeChargeCents: centsSchema.optional(),
  productsTotalCents: centsSchema.optional(),
  backendGrossCents: centsSchema.optional(),
  reserveCents: centsSchema.optional().nullable(),
  lenderName: z.string().max(500).optional(),
  firstPaymentDate: z
    .string()
    .optional()
    .transform((s) => (s && s.trim() ? new Date(s.trim()) : undefined)),
  notes: z.string().max(10000).optional(),
});

export const patchFinanceStatusBodySchema = z.object({
  status: dealFinanceStatusSchema,
});

export const listFinanceProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createFinanceProductBodySchema = z.object({
  productType: dealFinanceProductTypeSchema,
  name: z.string().min(1).max(500),
  priceCents: centsSchema,
  costCents: centsSchema.optional().nullable(),
  taxable: z.boolean().optional().default(false),
  includedInAmountFinanced: z.boolean(),
});

export const updateFinanceProductBodySchema = z.object({
  productType: dealFinanceProductTypeSchema.optional(),
  name: z.string().min(1).max(500).optional(),
  priceCents: centsSchema.optional(),
  costCents: centsSchema.optional().nullable(),
  taxable: z.boolean().optional(),
  includedInAmountFinanced: z.boolean().optional(),
});

export const dealIdProductIdParamSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
});
