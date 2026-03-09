import { z } from "zod";

const sourceType = z.enum(["AUCTION", "TRADE_IN", "MARKETPLACE", "STREET"]);
const status = z.enum(["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"]);

export const listAcquisitionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: status.optional(),
  sourceType: sourceType.optional(),
  vin: z.string().optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const createAcquisitionBodySchema = z.object({
  vin: z.string().min(1).max(17),
  sourceType,
  sellerName: z.string().optional(),
  sellerPhone: z.string().optional(),
  sellerEmail: z.string().optional(),
  askingPriceCents: z.string().optional(),
  negotiatedPriceCents: z.string().optional(),
  appraisalId: z.string().uuid().optional(),
});

export const updateAcquisitionBodySchema = createAcquisitionBodySchema.partial().omit({ vin: true, sourceType: true });

export const moveStageBodySchema = z.object({ status });
