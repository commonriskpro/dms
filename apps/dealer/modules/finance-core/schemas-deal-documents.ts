import { z } from "zod";

export const dealDocumentCategorySchema = z.enum([
  "CONTRACT",
  "ID",
  "INSURANCE",
  "STIPULATION",
  "CREDIT",
  "COMPLIANCE",
  "OTHER",
]);

export const listDealDocumentsQuerySchema = z.object({
  dealId: z.string().uuid(),
  category: dealDocumentCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
