import { z } from "zod";
import { DEALER_APPLICATION_SOURCE, DEALER_APPLICATION_STATUS } from "../constants";

export const dealerApplicationProfileSchema = z.object({
  businessInfo: z.record(z.unknown()).nullable().optional(),
  ownerInfo: z.record(z.unknown()).nullable().optional(),
  primaryContact: z.record(z.unknown()).nullable().optional(),
  additionalLocations: z.unknown().nullable().optional(),
  pricingPackageInterest: z.record(z.unknown()).nullable().optional(),
  acknowledgments: z.record(z.unknown()).nullable().optional(),
});
export type DealerApplicationProfile = z.infer<typeof dealerApplicationProfileSchema>;

export const dealerApplicationListQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(25),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(DEALER_APPLICATION_STATUS).optional(),
  source: z.enum(DEALER_APPLICATION_SOURCE).optional(),
});
export type DealerApplicationListQuery = z.infer<typeof dealerApplicationListQuerySchema>;

export const dealerApplicationListItemSchema = z.object({
  id: z.string().uuid(),
  dealerApplicationId: z.string().uuid(),
  source: z.enum(DEALER_APPLICATION_SOURCE),
  status: z.enum(DEALER_APPLICATION_STATUS),
  ownerEmail: z.string().email(),
  submittedAt: z.string().datetime().nullable(),
  approvedAt: z.string().datetime().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  activationSentAt: z.string().datetime().nullable(),
  activatedAt: z.string().datetime().nullable(),
  dealerDealershipId: z.string().uuid().nullable(),
  platformApplicationId: z.string().uuid().nullable(),
  platformDealershipId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DealerApplicationListItem = z.infer<typeof dealerApplicationListItemSchema>;

export const dealerApplicationsListResponseSchema = z.object({
  data: z.array(dealerApplicationListItemSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  }),
});
export type DealerApplicationsListResponse = z.infer<typeof dealerApplicationsListResponseSchema>;

export const dealerApplicationDetailSchema = dealerApplicationListItemSchema.extend({
  dealerInviteId: z.string().uuid().nullable(),
  invitedByUserId: z.string().uuid().nullable(),
  reviewerUserId: z.string().uuid().nullable(),
  reviewNotes: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  profile: dealerApplicationProfileSchema.nullable(),
});
export type DealerApplicationDetail = z.infer<typeof dealerApplicationDetailSchema>;

export const dealerApplicationPatchRequestSchema = z.object({
  status: z.enum(DEALER_APPLICATION_STATUS).optional(),
  platformApplicationId: z.string().uuid().nullable().optional(),
  platformDealershipId: z.string().uuid().nullable().optional(),
  dealerDealershipId: z.string().uuid().nullable().optional(),
  reviewerUserId: z.string().uuid().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
});
export type DealerApplicationPatchRequest = z.infer<typeof dealerApplicationPatchRequestSchema>;

export const dealerApplicationSyncPayloadSchema = z.object({
  dealerApplicationId: z.string().uuid(),
  source: z.enum(DEALER_APPLICATION_SOURCE),
  status: z.enum(DEALER_APPLICATION_STATUS),
  ownerEmail: z.string().email(),
  dealerInviteId: z.string().uuid().nullable().optional(),
  invitedByUserId: z.string().uuid().nullable().optional(),
  dealerDealershipId: z.string().uuid().nullable().optional(),
  platformApplicationId: z.string().uuid().nullable().optional(),
  platformDealershipId: z.string().uuid().nullable().optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
  rejectedAt: z.string().datetime().nullable().optional(),
  activationSentAt: z.string().datetime().nullable().optional(),
  activatedAt: z.string().datetime().nullable().optional(),
  reviewerUserId: z.string().uuid().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  profile: dealerApplicationProfileSchema.nullable().optional(),
});
export type DealerApplicationSyncPayload = z.infer<typeof dealerApplicationSyncPayloadSchema>;

export const dealerApplicationSyncResponseSchema = z.object({
  id: z.string().uuid(),
  dealerApplicationId: z.string().uuid(),
  status: z.enum(DEALER_APPLICATION_STATUS),
  updatedAt: z.string().datetime(),
});
export type DealerApplicationSyncResponse = z.infer<typeof dealerApplicationSyncResponseSchema>;
