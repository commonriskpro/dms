import { z } from "zod";
import { DocumentType } from "@prisma/client";

export const entityTypeSchema = z.enum(["DEAL", "CUSTOMER", "VEHICLE"]);
export const documentTypeSchema = z.nativeEnum(DocumentType);

export const listDocumentsQuerySchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().uuid(),
  docType: documentTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const documentIdParamSchema = z.object({
  documentId: z.string().uuid(),
});

export const signedUrlQuerySchema = z.object({
  documentId: z.string().uuid(),
});

export const patchDocumentBodySchema = z.object({
  title: z.string().max(255).optional().nullable(),
  docType: documentTypeSchema.optional().nullable(),
  tags: z.array(z.string()).optional(),
});
