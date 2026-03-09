import { z } from "zod";

export const createPricingRuleBodySchema = z.object({
  name: z.string().min(1).max(256),
  ruleType: z.enum(["AGE_BASED", "MARKET_BASED", "CLEARANCE"]),
  daysInStock: z.coerce.number().int().min(0).optional(),
  adjustmentPercent: z.number().finite().min(-100).max(100).optional(),
  adjustmentCents: z.number().int().finite().optional(),
  enabled: z.boolean().optional(),
});

export const updatePricingRuleBodySchema = createPricingRuleBodySchema.partial().omit({ name: true, ruleType: true });
