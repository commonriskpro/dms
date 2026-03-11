import { z } from "zod";

const centsSchema = z
  .union([z.string(), z.number()])
  .transform((v) => {
    const s = String(v).trim();
    const n = BigInt(s);
    if (n < BigInt(0)) throw new Error("Cents must be non-negative");
    return n;
  });

export const listLendersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().optional(),
});

export const lenderIdParamSchema = z.object({ id: z.string().uuid() });

export const lenderTypeSchema = z.enum(["BANK", "CREDIT_UNION", "CAPTIVE", "OTHER"]);
export const lenderExternalSystemSchema = z.enum(["NONE", "ROUTEONE", "DEALERTRACK", "CUDL", "OTHER"]);

export const createLenderBodySchema = z.object({
  name: z.string().min(1).max(500),
  lenderType: lenderTypeSchema,
  contactEmail: z.string().email().max(500).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  externalSystem: lenderExternalSystemSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateLenderBodySchema = z.object({
  name: z.string().min(1).max(500).optional(),
  lenderType: lenderTypeSchema.optional(),
  contactEmail: z.string().email().max(500).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  externalSystem: lenderExternalSystemSchema.optional(),
  isActive: z.boolean().optional(),
});

export const applicationIdParamSchema = z.object({ applicationId: z.string().uuid() });
export const submissionIdParamSchema = z.object({ submissionId: z.string().uuid() });
export const stipIdParamSchema = z.object({ stipId: z.string().uuid() });

export const listApplicationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createApplicationBodySchema = z.object({
  status: z.enum(["DRAFT", "COMPLETED"]).optional(),
});

export const updateApplicationBodySchema = z.object({
  status: z.enum(["DRAFT", "COMPLETED"]).optional(),
});

export const listSubmissionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: z
    .enum(["DRAFT", "READY_TO_SUBMIT", "SUBMITTED", "DECISIONED", "FUNDED", "CANCELED"])
    .optional(),
});

export const createSubmissionBodySchema = z.object({
  lenderId: z.string().uuid(),
  reserveEstimateCents: centsSchema.optional().nullable(),
});

export const updateSubmissionBodySchema = z.object({
  status: z
    .enum(["DRAFT", "READY_TO_SUBMIT", "SUBMITTED", "DECISIONED", "FUNDED", "CANCELED"])
    .optional(),
  decisionStatus: z.enum(["APPROVED", "CONDITIONAL", "DECLINED", "PENDING"]).optional().nullable(),
  approvedTermMonths: z.number().int().min(1).max(84).optional().nullable(),
  approvedAprBps: z.number().int().min(0).max(9999).optional().nullable(),
  approvedPaymentCents: centsSchema.optional().nullable(),
  maxAdvanceCents: centsSchema.optional().nullable(),
  decisionNotes: z.string().max(2000).optional().nullable(),
  reserveEstimateCents: centsSchema.optional().nullable(),
});

export const updateSubmissionFundingBodySchema = z.object({
  fundingStatus: z.enum(["PENDING", "FUNDED", "CANCELED"]),
  fundedAt: z.string().datetime().optional().transform((s) => (s ? new Date(s) : undefined)),
  fundedAmountCents: centsSchema.optional().nullable(),
  reserveFinalCents: centsSchema.optional().nullable(),
});

export const listStipulationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["REQUESTED", "RECEIVED", "WAIVED"]).optional(),
  stipType: z
    .enum(["PAYSTUB", "PROOF_RESIDENCE", "INSURANCE", "LICENSE", "BANK_STATEMENT", "OTHER"])
    .optional(),
});

export const stipTypeSchema = z.enum([
  "PAYSTUB",
  "PROOF_RESIDENCE",
  "INSURANCE",
  "LICENSE",
  "BANK_STATEMENT",
  "OTHER",
]);
export const stipStatusSchema = z.enum(["REQUESTED", "RECEIVED", "WAIVED"]);

export const createStipulationBodySchema = z.object({
  stipType: stipTypeSchema,
  status: stipStatusSchema.optional().default("REQUESTED"),
  requestedAt: z.string().datetime().optional().transform((s) => (s ? new Date(s) : undefined)),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateStipulationBodySchema = z.object({
  stipType: stipTypeSchema.optional(),
  status: stipStatusSchema.optional(),
  requestedAt: z
    .union([z.string().datetime(), z.null()])
    .optional()
    .transform((s) => (s && s !== "" ? new Date(s as string) : undefined)),
  receivedAt: z
    .union([z.string().datetime(), z.null()])
    .optional()
    .transform((s) => (s && s !== "" ? new Date(s as string) : undefined)),
  documentId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
