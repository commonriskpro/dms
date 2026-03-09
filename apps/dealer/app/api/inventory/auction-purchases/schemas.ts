import { z } from "zod";

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

const purchaseStatus = z.enum(["PENDING", "IN_TRANSIT", "RECEIVED", "CANCELLED"]);

export const listAuctionPurchasesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: purchaseStatus.optional(),
  vehicleId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "etaDate"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createAuctionPurchaseBodySchema = z.object({
  vehicleId: z.string().uuid().optional().nullable(),
  auctionName: z.string().min(1).max(256),
  lotNumber: z.string().min(1).max(128),
  purchasePriceCents: z.string().min(1).refine((v) => {
    try {
      return BigInt(v) >= BigInt(0);
    } catch {
      return false;
    }
  }, "Must be non-negative integer string"),
  feesCents: centsOptional,
  shippingCents: centsOptional,
  etaDate: z.string().datetime().optional().nullable(),
  status: purchaseStatus.optional(),
  notes: z.string().optional().nullable(),
});

export const updateAuctionPurchaseBodySchema = createAuctionPurchaseBodySchema.partial();

export const auctionPurchaseIdParamSchema = z.object({ id: z.string().uuid() });
