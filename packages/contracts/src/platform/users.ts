/**
 * Platform user management API contracts.
 * No Prisma, no env. Used by apps/platform only.
 */

import { z } from "zod";
import { PLATFORM_ROLES } from "../constants";

export const platformRoleSchema = z.enum(PLATFORM_ROLES);

/** Single platform user (API response item). Enrichment fields from Supabase Auth (display-only). */
export const platformUserSchema = z.object({
  id: z.string().uuid(),
  role: platformRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  disabledAt: z.string().datetime().nullable().optional(),
  email: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  lastSignInAt: z.string().datetime().nullable().optional(),
});
export type PlatformUser = z.infer<typeof platformUserSchema>;

/** List platform users query */
export const platformListUsersQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  q: z.string().max(100).optional(),
  role: platformRoleSchema.optional(),
});
export type PlatformListUsersQuery = z.infer<typeof platformListUsersQuerySchema>;

/** List response: data + meta (total, limit, offset) */
export const platformListUsersResponseSchema = z.object({
  data: z.array(platformUserSchema),
  meta: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  }),
});
export type PlatformListUsersResponse = z.infer<typeof platformListUsersResponseSchema>;

/** POST create/upsert: id (Supabase auth user UUID) + role */
export const platformCreateUserRequestSchema = z.object({
  id: z.string().uuid(),
  role: platformRoleSchema,
});
export type PlatformCreateUserRequest = z.infer<typeof platformCreateUserRequestSchema>;

/** POST create/upsert response */
export const platformCreateUserResponseSchema = z.object({
  data: platformUserSchema,
});
export type PlatformCreateUserResponse = z.infer<typeof platformCreateUserResponseSchema>;

/** PATCH update: role and/or disabled */
export const platformUpdateUserRequestSchema = z.object({
  role: platformRoleSchema.optional(),
  disabled: z.boolean().optional(),
});
export type PlatformUpdateUserRequest = z.infer<typeof platformUpdateUserRequestSchema>;

/** PATCH update response */
export const platformUpdateUserResponseSchema = z.object({
  data: platformUserSchema,
});
export type PlatformUpdateUserResponse = z.infer<typeof platformUpdateUserResponseSchema>;

/** POST invite by email: email + optional role (default PLATFORM_SUPPORT in app) */
export const platformInviteUserRequestSchema = z.object({
  email: z.string().email().transform((t: string) => t.trim().toLowerCase()),
  role: platformRoleSchema.optional(),
});
export type PlatformInviteUserRequest = z.infer<typeof platformInviteUserRequestSchema>;

/** POST invite by email response */
export const platformInviteUserResponseSchema = z.object({
  ok: z.literal(true),
  invited: z.boolean(),
  userId: z.string().uuid().optional(),
  role: platformRoleSchema,
  alreadySentRecently: z.boolean().optional(),
});
export type PlatformInviteUserResponse = z.infer<typeof platformInviteUserResponseSchema>;
