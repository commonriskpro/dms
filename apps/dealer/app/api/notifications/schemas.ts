import { z } from "zod";

export const notificationIdParamSchema = z.object({ id: z.string().uuid() });

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

export const markNotificationReadBodySchema = z
  .object({
    read: z.literal(true).optional(),
  })
  .optional()
  .default({});
