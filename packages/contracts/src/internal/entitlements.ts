import { z } from "zod";

/** Entitlements snapshot: modules enabled for a dealership (platform source of truth). */
export const entitlementsResponseSchema = z.object({
  modules: z.array(z.string()),
  maxSeats: z.number().int().positive().nullable(),
  features: z.record(z.boolean()).optional().default({}),
});
export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;
