import { z } from "zod";

export const backfillBodySchema = z.object({
  dealershipId: z.string().uuid(),
  limitVehicles: z.coerce.number().int().min(1).max(500).optional().default(200),
  cursor: z.coerce.number().int().min(0).optional().default(0),
});
