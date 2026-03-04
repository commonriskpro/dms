import { z } from "zod";
import { DEALER_LIFECYCLE_STATUS, type DealershipLifecycleStatus } from "../constants";

/** Platform API: POST provision request body (idempotency key required) */
export const platformProvisionDealershipRequestSchema = z.object({
  idempotencyKey: z.string().min(1).max(255),
});
export type PlatformProvisionDealershipRequest = z.infer<typeof platformProvisionDealershipRequestSchema>;

/** Platform API: POST provision response */
export const platformProvisionDealershipResponseSchema = z.object({
  status: z.enum(["PROVISIONING", "PROVISIONED"]),
  dealerDealershipId: z.string().uuid().optional(),
  provisionedAt: z.string().optional(),
});
export type PlatformProvisionDealershipResponse = z.infer<typeof platformProvisionDealershipResponseSchema>;

/** Platform-side action: trigger provisioning (payload for service, not HTTP body) */
export const dealershipProvisionActionSchema = z.object({
  platformDealershipId: z.string().uuid(),
  legalName: z.string().min(1).max(500),
  displayName: z.string().min(1).max(200),
  planKey: z.string().min(1).max(100),
  limits: z.record(z.union([z.number(), z.string()])).optional().default({}),
  idempotencyKey: z.string().min(1).max(255),
});
export type DealershipProvisionAction = z.infer<typeof dealershipProvisionActionSchema>;

export const dealershipProvisionResultSchema = z.object({
  dealerDealershipId: z.string().uuid(),
  provisionedAt: z.string().datetime(),
});
export type DealershipProvisionResult = z.infer<typeof dealershipProvisionResultSchema>;

/** Platform-side status change (e.g. after calling dealer internal API) */
export const dealershipStatusChangeRequestSchema = z.object({
  status: z.enum(DEALER_LIFECYCLE_STATUS),
  reason: z.string().max(2000).optional(),
});
export type DealershipStatusChangeRequest = z.infer<typeof dealershipStatusChangeRequestSchema>;

/** Platform API: set dealership status; reason required for SUSPENDED/CLOSED */
export const platformSetDealershipStatusRequestSchema = z
  .object({
    status: z.enum(DEALER_LIFECYCLE_STATUS),
    reason: z.string().max(2000).optional(),
  })
  .refine(
    (data: { status: DealershipLifecycleStatus; reason?: string }) =>
      data.status === "ACTIVE" || (typeof data.reason === "string" && data.reason.trim().length > 0),
    { message: "Reason is required for SUSPENDED or CLOSED", path: ["reason"] }
  );
export type PlatformSetDealershipStatusRequest = z.infer<typeof platformSetDealershipStatusRequestSchema>;

export const dealershipStatusChangeResponseSchema = z.object({
  ok: z.literal(true),
});
export type DealershipStatusChangeResponse = z.infer<typeof dealershipStatusChangeResponseSchema>;

/** Platform API: POST /api/platform/dealerships request body */
export const platformCreateDealershipRequestSchema = z.object({
  legalName: z.string().min(1).max(500),
  displayName: z.string().min(1).max(200),
  planKey: z.string().min(1).max(100),
  limits: z.record(z.union([z.number(), z.string()])).optional(),
});
export type PlatformCreateDealershipRequest = z.infer<typeof platformCreateDealershipRequestSchema>;

/** Platform API: POST /api/platform/dealerships response (created dealership) */
export const platformCreateDealershipResponseSchema = z.object({
  id: z.string().uuid(),
  legalName: z.string(),
  displayName: z.string(),
  planKey: z.string(),
  limits: z.record(z.union([z.number(), z.string()])).nullable(),
  status: z.literal("APPROVED"),
  createdAt: z.string().datetime(),
});
export type PlatformCreateDealershipResponse = z.infer<typeof platformCreateDealershipResponseSchema>;

/** List platform dealerships query */
export const listPlatformDealershipsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(DEALER_LIFECYCLE_STATUS).optional(),
});
export type ListPlatformDealershipsQuery = z.infer<typeof listPlatformDealershipsQuerySchema>;

/** Platform API: POST /api/platform/dealerships/[id]/owner-invite request */
export const platformOwnerInviteRequestSchema = z.object({
  email: z.string().email(),
});
export type PlatformOwnerInviteRequest = z.infer<typeof platformOwnerInviteRequestSchema>;

/** Platform API: owner-invite response (acceptUrl when dealer returns it; alreadySentRecently when deduped) */
export const platformOwnerInviteResponseSchema = z.object({
  ok: z.literal(true),
  dealerDealershipId: z.string().uuid(),
  inviteId: z.string().uuid(),
  acceptUrl: z.string().url().optional(),
  alreadySentRecently: z.boolean().optional(),
});
export type PlatformOwnerInviteResponse = z.infer<typeof platformOwnerInviteResponseSchema>;
