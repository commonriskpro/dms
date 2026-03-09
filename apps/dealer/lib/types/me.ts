import { z } from "zod";

/** Single dealership in GET /api/me/dealerships response */
export const meDealershipItemSchema = z.object({
  dealershipId: z.string().uuid(),
  dealershipName: z.string(),
  roleKey: z.string().nullable(),
  roleName: z.string(),
  isActive: z.boolean(),
});
export type MeDealershipItem = z.infer<typeof meDealershipItemSchema>;

/** GET /api/me/dealerships response */
export const meDealershipsResponseSchema = z.object({
  data: z.object({
    dealerships: z.array(meDealershipItemSchema),
  }),
});
export type MeDealershipsResponse = z.infer<typeof meDealershipsResponseSchema>;

/** Current dealership payload in GET/POST /api/me/current-dealership */
export const meCurrentDealershipPayloadSchema = z.object({
  dealershipId: z.string().uuid(),
  dealershipName: z.string(),
  roleKey: z.string().nullable(),
  roleName: z.string(),
});
export type MeCurrentDealershipPayload = z.infer<typeof meCurrentDealershipPayloadSchema>;

/** GET /api/me/current-dealership response */
export const meCurrentDealershipGetResponseSchema = z.object({
  data: meCurrentDealershipPayloadSchema.nullable(),
  availableCount: z.number().optional(),
});
export type MeCurrentDealershipGetResponse = z.infer<typeof meCurrentDealershipGetResponseSchema>;

/** POST /api/me/current-dealership request body */
export const meCurrentDealershipPostBodySchema = z.object({
  dealershipId: z.string().uuid(),
});
export type MeCurrentDealershipPostBody = z.infer<typeof meCurrentDealershipPostBodySchema>;

/** POST /api/me/current-dealership response */
export const meCurrentDealershipPostResponseSchema = z.object({
  data: meCurrentDealershipPayloadSchema,
});
export type MeCurrentDealershipPostResponse = z.infer<typeof meCurrentDealershipPostResponseSchema>;
