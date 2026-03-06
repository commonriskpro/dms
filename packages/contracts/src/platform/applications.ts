import { z } from "zod";
import { APPLICATION_STATUS } from "../constants";

export const applicationCreateRequestSchema = z.object({
  legalName: z.string().min(1).max(500),
  displayName: z.string().min(1).max(200),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});
export type ApplicationCreateRequest = z.infer<typeof applicationCreateRequestSchema>;

export const applicationCreateResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUS),
  legalName: z.string(),
  displayName: z.string(),
  contactEmail: z.string(),
  createdAt: z.string().datetime(),
});
export type ApplicationCreateResponse = z.infer<typeof applicationCreateResponseSchema>;

export const applicationApproveRequestSchema = z.object({}).strict();
export type ApplicationApproveRequest = z.infer<typeof applicationApproveRequestSchema>;

export const applicationApproveResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("APPROVED"),
});
export type ApplicationApproveResponse = z.infer<typeof applicationApproveResponseSchema>;

export const applicationRejectRequestSchema = z.object({
  reason: z.string().min(1).max(2000),
});
export type ApplicationRejectRequest = z.infer<typeof applicationRejectRequestSchema>;

export const applicationRejectResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("REJECTED"),
});
export type ApplicationRejectResponse = z.infer<typeof applicationRejectResponseSchema>;

export const listApplicationsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(APPLICATION_STATUS).optional(),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;

/** Provision dealership from application — response */
export const applicationProvisionResponseSchema = z.object({
  dealershipId: z.string().uuid(),
  displayName: z.string(),
  status: z.string(),
  dealerDealershipId: z.string().uuid().optional(),
  provisionedAt: z.string().datetime().optional(),
});
export type ApplicationProvisionResponse = z.infer<typeof applicationProvisionResponseSchema>;

/** Invite owner for application — response */
export const applicationInviteOwnerResponseSchema = z.object({
  inviteId: z.string().uuid(),
  status: z.literal("PENDING"),
  expiresAt: z.string().datetime().optional(),
});
export type ApplicationInviteOwnerResponse = z.infer<typeof applicationInviteOwnerResponseSchema>;

/** Owner invite status (from dealer internal or platform merge) */
export const ownerInviteStatusSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"]),
  expiresAt: z.string().datetime().optional().nullable(),
  acceptedAt: z.string().datetime().optional().nullable(),
  lastSentAt: z.string().datetime().optional().nullable(),
});
export type OwnerInviteStatus = z.infer<typeof ownerInviteStatusSchema>;

/** Dealership summary on application detail */
export const applicationDealershipSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  status: z.string(),
  dealerDealershipId: z.string().uuid().optional(),
  provisionedAt: z.string().datetime().optional(),
});
export type ApplicationDealershipSummary = z.infer<typeof applicationDealershipSummarySchema>;
