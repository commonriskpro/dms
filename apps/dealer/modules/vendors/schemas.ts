import { z } from "zod";

export const vendorTypeSchema = z.enum([
  "auction",
  "transporter",
  "repair",
  "parts",
  "detail",
  "inspection",
  "title_doc",
  "other",
]);

export const listVendorsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(256).optional(),
  type: vendorTypeSchema.optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

export const vendorIdParamSchema = z.object({ id: z.string().uuid() });

export const createVendorBodySchema = z.object({
  name: z.string().min(1).max(256),
  type: vendorTypeSchema,
  contactName: z.string().max(256).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().email().max(256).optional().nullable(),
  address: z.string().max(512).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateVendorBodySchema = z.object({
  name: z.string().min(1).max(256).optional(),
  type: vendorTypeSchema.optional(),
  contactName: z.string().max(256).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().email().max(256).optional().nullable(),
  address: z.string().max(512).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});
