import { z } from "zod";

export const createDraftBodySchema = z.object({
  source: z.enum(["invite", "public_apply"]),
  ownerEmail: z.string().email(),
  inviteId: z.string().uuid().optional().nullable(),
  invitedByUserId: z.string().uuid().optional().nullable(),
});

export const updateDraftBodySchema = z.object({
  businessInfo: z.record(z.unknown()).optional(),
  ownerInfo: z.record(z.unknown()).optional(),
  primaryContact: z.record(z.unknown()).optional(),
  additionalLocations: z.unknown().optional(),
  pricingPackageInterest: z.record(z.unknown()).optional(),
  acknowledgments: z.record(z.unknown()).optional(),
});
