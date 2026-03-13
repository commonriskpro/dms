import { z } from "zod";

const NAME_MAX = 200;

export const visibilitySchema = z.enum(["PERSONAL", "SHARED"]);

const filterDefinitionSchema = z.object({
  status: z.enum(["LEAD", "ACTIVE", "SOLD", "INACTIVE"]).optional(),
  draft: z.enum(["all", "draft", "final"]).optional(),
  leadSource: z.string().max(500).optional(),
  assignedTo: z.string().uuid().optional(),
  lastVisit: z.string().max(100).optional(),
  callbacks: z.union([z.literal(0), z.literal(1)]).optional(),
});

export const createSavedFilterBodySchema = z.object({
  name: z.string().min(1).max(NAME_MAX),
  visibility: visibilitySchema,
  definition: filterDefinitionSchema,
});

const SORT_BY_WHITELIST = ["created_at", "updated_at", "status"] as const;
const LIMIT_WHITELIST = [10, 25, 50, 100] as const;

export const stateJsonSchema = z.object({
  q: z.string().max(1000).optional(),
  status: z.enum(["LEAD", "ACTIVE", "SOLD", "INACTIVE"]).optional(),
  draft: z.enum(["all", "draft", "final"]).optional(),
  leadSource: z.string().max(500).optional(),
  assignedTo: z.string().uuid().optional(),
  lastVisit: z.string().max(100).optional(),
  callbacks: z.union([z.literal(0), z.literal(1)]).optional(),
  sortBy: z.enum(SORT_BY_WHITELIST).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  columns: z.array(z.string().max(100)).optional(),
  density: z.string().max(50).optional(),
});

export const createSavedSearchBodySchema = z.object({
  name: z.string().min(1).max(NAME_MAX),
  visibility: visibilitySchema,
  state: stateJsonSchema,
  isDefault: z.boolean().optional(),
});

export const updateSavedSearchBodySchema = z.object({
  name: z.string().min(1).max(NAME_MAX).optional(),
  visibility: visibilitySchema.optional(),
  state: stateJsonSchema.optional(),
  isDefault: z.boolean().optional(),
});
