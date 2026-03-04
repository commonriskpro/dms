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

export const idParamSchema = z.object({ id: z.string().uuid() });

export const vinDecodeBodySchema = z.object({
  vin: z.string().min(8).max(17),
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
