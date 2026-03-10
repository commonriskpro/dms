import { z } from "zod";

/** Current dealership payload in GET/POST /api/me/current-dealership */
export const meCurrentDealershipPayloadSchema = z.object({
  dealershipId: z.string().uuid(),
  dealershipName: z.string(),
  roleKey: z.string().nullable(),
  roleName: z.string(),
});

/** POST /api/me/current-dealership request body */
export const meCurrentDealershipPostBodySchema = z.object({
  dealershipId: z.string().uuid(),
});
