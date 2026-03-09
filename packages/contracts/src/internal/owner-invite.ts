import { z } from "zod";

/** Dealer internal: POST /api/internal/dealerships/[dealerDealershipId]/owner-invite request body */
export const dealerOwnerInviteRequestSchema = z.object({
  email: z.string().email(),
  platformDealershipId: z.string().uuid(),
  platformActorId: z.string().uuid(),
  dealerApplicationId: z.string().uuid().optional(),
});
export type DealerOwnerInviteRequest = z.infer<typeof dealerOwnerInviteRequestSchema>;

/** Dealer internal: owner-invite response (acceptUrl = one-time link for invitee) */
export const dealerOwnerInviteResponseSchema = z.object({
  inviteId: z.string().uuid(),
  invitedEmail: z.string().email(),
  createdAt: z.string().datetime(),
  acceptUrl: z.string().url().optional(),
});
export type DealerOwnerInviteResponse = z.infer<typeof dealerOwnerInviteResponseSchema>;

/** Dealer internal: GET owner-invite-status response (no PII) */
export const dealerOwnerInviteStatusResponseSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"]),
  expiresAt: z.string().datetime().optional().nullable(),
  acceptedAt: z.string().datetime().optional().nullable(),
});
export type DealerOwnerInviteStatusResponse = z.infer<typeof dealerOwnerInviteStatusResponseSchema>;