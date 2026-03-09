import { z } from "zod";

export const signalDomainSchema = z.enum([
  "inventory",
  "crm",
  "deals",
  "operations",
  "acquisition",
]);

export const signalSeveritySchema = z.enum(["info", "success", "warning", "danger"]);

export const listSignalsQuerySchema = z.object({
  domain: signalDomainSchema.optional(),
  severity: signalSeveritySchema.optional(),
  includeResolved: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
