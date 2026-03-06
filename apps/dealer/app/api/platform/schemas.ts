import { z } from "zod";

export const listDealershipsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().max(200).optional(),
});

export const createDealershipBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).optional(),
  createDefaultLocation: z.boolean().optional().default(true),
});

export const patchDealershipBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listMembersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const addMemberBodySchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
});

export const patchMembershipBodySchema = z.object({
  roleId: z.string().uuid().optional(),
  disabled: z.boolean().optional(),
});

export const impersonateBodySchema = z.object({
  dealershipId: z.string().uuid(),
});

export const createInviteBodySchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid(),
  expiresAt: z.coerce.date().optional(),
});

export const patchInviteBodySchema = z.object({
  cancel: z.boolean().optional(),
  expiresAt: z.coerce.date().optional(),
});

export const listInvitesQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"]).optional(),
});

/** Invite token: non-empty, max 256 chars (hex tokens are 64). No token value in logs. */
const inviteTokenSchema = z.string().min(1, "Token is required").max(256, "Invalid token format");

export const resolveInviteQuerySchema = z.object({
  token: inviteTokenSchema,
});

export const acceptInviteBodySchema = z.object({
  token: inviteTokenSchema,
});

export const acceptInviteSignupBodySchema = z.object({
  token: inviteTokenSchema,
  email: z.string().email(),
  password: z.string().min(12),
  confirmPassword: z.string().optional(),
  fullName: z.string().max(200).optional(),
});

export const approvePendingBodySchema = z.object({
  dealershipId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const listPendingQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().max(200).optional(),
});
