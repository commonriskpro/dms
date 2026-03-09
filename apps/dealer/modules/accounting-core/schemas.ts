import { z } from "zod";

export const accountingAccountTypeSchema = z.enum([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);
export const accountingReferenceTypeSchema = z.enum([
  "DEAL",
  "VEHICLE",
  "EXPENSE",
  "MANUAL",
  "OTHER",
]);
export const accountingEntryDirectionSchema = z.enum(["DEBIT", "CREDIT"]);
export const dealershipExpenseStatusSchema = z.enum(["OPEN", "POSTED", "VOID"]);

export const listAccountsQuerySchema = z.object({
  type: accountingAccountTypeSchema.optional(),
  activeOnly: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createAccountBodySchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(256),
  type: accountingAccountTypeSchema,
}).strict();

export const listTransactionsQuerySchema = z.object({
  referenceType: accountingReferenceTypeSchema.optional(),
  referenceId: z.string().uuid().optional(),
  postedFrom: z.string().datetime().optional(),
  postedTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createTransactionBodySchema = z.object({
  referenceType: accountingReferenceTypeSchema,
  referenceId: z.string().uuid().optional().nullable(),
  memo: z.string().max(500).optional().nullable(),
}).strict();

export const addEntryBodySchema = z.object({
  accountId: z.string().uuid(),
  direction: accountingEntryDirectionSchema,
  amountCents: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? BigInt(v) : BigInt(Math.round(v))
  ),
  memo: z.string().max(255).optional().nullable(),
}).strict();

export const listExpensesQuerySchema = z.object({
  status: dealershipExpenseStatusSchema.optional(),
  dealId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  incurredFrom: z.string().datetime().optional(),
  incurredTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createExpenseBodySchema = z.object({
  category: z.string().min(1).max(128),
  vendor: z.string().max(256).optional().nullable(),
  description: z.string().optional().nullable(),
  amountCents: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? BigInt(v) : BigInt(Math.round(v))
  ),
  vehicleId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  incurredOn: z.string().min(1),
}).strict();

export const updateExpenseBodySchema = z.object({
  category: z.string().min(1).max(128).optional(),
  vendor: z.string().max(256).optional().nullable(),
  description: z.string().optional().nullable(),
  amountCents: z.union([z.string(), z.number()]).transform((v) =>
    typeof v === "string" ? BigInt(v) : BigInt(Math.round(v))
  ).optional(),
  vehicleId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  incurredOn: z.string().min(1).optional(),
  status: dealershipExpenseStatusSchema.optional(),
}).strict();
