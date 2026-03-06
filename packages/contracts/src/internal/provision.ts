import { z } from "zod";
import { DEALER_LIFECYCLE_STATUS } from "../constants";

export const provisionDealershipRequestSchema = z.object({
  platformDealershipId: z.string().uuid(),
  legalName: z.string().min(1).max(500),
  displayName: z.string().min(1).max(200),
  primaryOwnerEmail: z.string().email().optional(),
  planKey: z.string().min(1).max(100),
  limits: z.record(z.union([z.number(), z.string()])).optional().default({}),
  initialConfig: z.record(z.unknown()).optional().default({}),
});
export type ProvisionDealershipRequest = z.infer<typeof provisionDealershipRequestSchema>;

export const provisionDealershipResponseSchema = z.object({
  dealerDealershipId: z.string().uuid(),
  provisionedAt: z.string().datetime(),
});
export type ProvisionDealershipResponse = z.infer<typeof provisionDealershipResponseSchema>;

export const setDealershipStatusRequestSchema = z.object({
  status: z.enum(DEALER_LIFECYCLE_STATUS),
  reason: z.string().max(2000).optional(),
  platformActorId: z.string().uuid().optional(),
});
export type SetDealershipStatusRequest = z.infer<typeof setDealershipStatusRequestSchema>;

export const setDealershipStatusResponseSchema = z.object({
  ok: z.literal(true),
});
export type SetDealershipStatusResponse = z.infer<typeof setDealershipStatusResponseSchema>;
