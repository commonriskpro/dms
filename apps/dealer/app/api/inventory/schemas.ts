import { z } from "zod";

export const vehicleStatusSchema = z.enum([
  "AVAILABLE",
  "HOLD",
  "SOLD",
  "WHOLESALE",
  "REPAIR",
  "ARCHIVED",
]);

export const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
    status: vehicleStatusSchema.optional(),
    locationId: z.string().uuid().optional(),
    year: z.coerce.number().int().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    vin: z.string().optional(),
    stockNumber: z.string().optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    search: z.string().optional(),
    sortBy: z
      .enum(["createdAt", "salePriceCents", "mileage", "stockNumber", "updatedAt"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .refine(
    (q) =>
      q.minPrice == null ||
      q.maxPrice == null ||
      q.minPrice <= q.maxPrice,
    { message: "minPrice must be less than or equal to maxPrice", path: ["maxPrice"] }
  );

export const createBodySchema = z.object({
  isDraft: z.boolean().optional(),
  vin: z.string().max(17).optional(),
  year: z.number().int().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  stockNumber: z.string().min(1),
  mileage: z.number().int().min(0).optional(),
  color: z.string().optional(),
  status: vehicleStatusSchema.optional(),
  salePriceCents: z.union([z.string().regex(/^-?\d+$/), z.number().int()]).optional(),
  auctionCostCents: z.union([z.string().regex(/^-?\d+$/), z.number().int()]).optional(),
  transportCostCents: z.union([z.string().regex(/^-?\d+$/), z.number().int()]).optional(),
  reconCostCents: z.union([z.string().regex(/^-?\d+$/), z.number().int()]).optional(),
  miscCostCents: z.union([z.string().regex(/^-?\d+$/), z.number().int()]).optional(),
  locationId: z.string().uuid().optional(),
});

export const updateBodySchema = createBodySchema.partial();

export const draftCreateBodySchema = createBodySchema.partial().extend({
  stockNumber: z.string().min(1).optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export const vinDecodeBodySchema = z.object({
  vin: z.string().min(8).max(17),
});

export const vinDecodeTriggerBodySchema = z.object({
  force: z.boolean().optional(),
});

export const vinGetQuerySchema = z.object({
  latestOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const valuationsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  source: z.string().optional(),
});

export const requestValuationBodySchema = z.object({
  source: z.enum(["KBB", "NADA", "MOCK"]),
  condition: z.string().optional(),
  odometer: z.number().int().nonnegative().optional(),
});

export const reconUpdateBodySchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const reconLineItemBodySchema = z.object({
  description: z.string().min(1).max(500),
  costCents: z.number().int().nonnegative(),
  category: z.string().max(50).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export const reconLineItemIdParamSchema = z.object({
  id: z.string().uuid(),
  lineItemId: z.string().uuid(),
});

export const floorplanUpsertBodySchema = z.object({
  lenderId: z.string().uuid(),
  principalCents: z.number().int().nonnegative(),
  aprBps: z.number().int().nonnegative().optional(),
  startDate: z.string().datetime(),
  nextCurtailmentDueDate: z.string().datetime().nullable().optional(),
});

export const curtailmentBodySchema = z.object({
  amountCents: z.number().int().nonnegative(),
  paidAt: z.string().datetime(),
});

export const payoffQuoteBodySchema = z.object({
  payoffQuoteCents: z.number().int().nonnegative(),
  payoffQuoteExpiresAt: z.string().datetime(),
});

export const agingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: vehicleStatusSchema.optional(),
  sortBy: z.enum(["daysInStock"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const photoFileIdParamSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
});

export const reorderPhotosBodySchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(20),
});

export const setPrimaryPhotoBodySchema = z.object({
  fileId: z.string().uuid(),
});

export const jobIdParamSchema = z.object({ jobId: z.string().uuid() });

export const listBulkImportJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED"]).optional(),
});

export const bulkUpdateBodySchema = z
  .object({
    vehicleIds: z.array(z.string().uuid()).min(1).max(50),
    status: vehicleStatusSchema.optional(),
    locationId: z.string().uuid().nullable().optional(),
  })
  .refine((d) => d.status !== undefined || d.locationId !== undefined, {
    message: "At least one of status or locationId is required",
  });

export const alertTypeSchema = z.enum(["MISSING_PHOTOS", "STALE", "RECON_OVERDUE"]);

export const alertsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  alertType: alertTypeSchema.optional(),
});

export const dismissAlertBodySchema = z
  .object({
    vehicleId: z.string().uuid(),
    alertType: alertTypeSchema,
    action: z.enum(["DISMISS", "SNOOZE"]),
    snoozedUntil: z.string().optional(),
  })
  .refine((d) => d.action !== "SNOOZE" || (d.snoozedUntil && d.snoozedUntil.trim().length > 0), {
    message: "snoozedUntil required when action is SNOOZE",
    path: ["snoozedUntil"],
  });

export const dismissalIdParamSchema = z.object({ id: z.string().uuid() });

// Slice E: Book values (manual)
export const bookValuesBodySchema = z.object({
  retailCents: z.number().int().nonnegative().optional(),
  tradeInCents: z.number().int().nonnegative().optional(),
  wholesaleCents: z.number().int().nonnegative().optional(),
  auctionCents: z.number().int().nonnegative().optional(),
  source: z.string().max(32).optional(),
});

// Slice F: ReconItem (standalone items with status)
export const reconItemStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]);
export const reconItemCreateBodySchema = z.object({
  description: z.string().min(1).max(256),
  costCents: z.number().int().nonnegative(),
  status: reconItemStatusSchema.optional(),
});
export const reconItemUpdateBodySchema = z.object({
  description: z.string().min(1).max(256).optional(),
  costCents: z.number().int().nonnegative().optional(),
  status: reconItemStatusSchema.optional(),
});
export const reconItemIdParamSchema = z.object({ reconItemId: z.string().uuid() });

// Slice G: FloorplanLoan (lender string)
export const floorplanLoanStatusSchema = z.enum(["ACTIVE", "PAID_OFF", "SOLD"]);
export const floorplanLoanBodySchema = z.object({
  lender: z.string().min(1).max(128),
  principalCents: z.number().int().nonnegative(),
  interestBps: z.number().int().min(0).max(5000).optional(),
  startDate: z.union([z.string().datetime(), z.coerce.date()]),
  curtailmentDate: z.union([z.string().datetime(), z.coerce.date()]).nullable().optional(),
  notes: z.string().max(1000).optional(),
});
export const floorplanLoanUpdateBodySchema = z.object({
  status: floorplanLoanStatusSchema,
});
export const floorplanLoanIdParamSchema = z.object({ floorplanLoanId: z.string().uuid() });

// Vehicle cost ledger (V1)
export const vehicleCostCategorySchema = z.enum([
  "acquisition",
  "auction_fee",
  "transport",
  "title_fee",
  "doc_fee",
  "recon_parts",
  "recon_labor",
  "detail",
  "inspection",
  "storage",
  "misc",
]);
export const vehicleCostDocumentKindSchema = z.enum([
  "invoice",
  "receipt",
  "bill_of_sale",
  "title_doc",
  "other",
]);
export const costEntryCreateBodySchema = z.object({
  description: z.string().max(256).optional().nullable(),
  category: vehicleCostCategorySchema,
  amountCents: z.union([z.string().regex(/^-?\d+$/), z.number().int()]),
  vendorId: z.string().uuid().optional().nullable(),
  vendorName: z.string().max(256).optional().nullable(),
  occurredAt: z.string().datetime(),
  memo: z.string().max(500).optional().nullable(),
});
export const costEntryUpdateBodySchema = z.object({
  description: z.string().max(256).nullable().optional(),
  category: vehicleCostCategorySchema.optional(),
  amountCents: z.union([z.string().regex(/^-?\d+$/), z.number().int()]).optional(),
  vendorId: z.string().uuid().optional().nullable(),
  vendorName: z.string().max(256).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
  memo: z.string().max(500).nullable().optional(),
});
export const costEntryIdParamSchema = z.object({ id: z.string().uuid(), entryId: z.string().uuid() });
export const costDocumentIdParamSchema = z.object({ id: z.string().uuid(), docId: z.string().uuid() });
