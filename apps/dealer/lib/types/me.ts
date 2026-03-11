import { z } from "zod";

/** POST /api/me/current-dealership request body */
export const meCurrentDealershipPostBodySchema = z.object({
  dealershipId: z.string().uuid(),
});
