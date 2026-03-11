import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(2, "Search term must be at least 2 characters")),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(50, "Limit must be at most 50")
    .default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0),
});
