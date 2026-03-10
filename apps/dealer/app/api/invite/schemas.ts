import { z } from "zod";

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
