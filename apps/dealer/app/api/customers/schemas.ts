import { z } from "zod";

export const customerStatusSchema = z.enum(["LEAD", "ACTIVE", "SOLD", "INACTIVE"]);
const centsString = z.string().regex(/^-?\d+$/).optional().nullable();
const dateString = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable();

const MAX_LIMIT = 100;
export const listCustomersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  status: customerStatusSchema.optional(),
  draft: z.enum(["all", "draft", "final"]).optional().default("all"),
  leadSource: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["created_at", "updated_at", "status"]).optional().default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const phoneInputSchema = z.object({
  kind: z.string().optional().nullable(),
  value: z.string().min(1),
  isPrimary: z.boolean().optional(),
});
const emailInputSchema = z.object({
  kind: z.string().optional().nullable(),
  value: z.string().min(1),
  isPrimary: z.boolean().optional(),
});

export const createCustomerBodySchema = z.object({
  name: z.string().min(1).max(500),
  customerClass: z.string().max(32).optional(),
  firstName: z.string().max(128).optional(),
  middleName: z.string().max(128).optional(),
  lastName: z.string().max(128).optional(),
  nameSuffix: z.string().max(64).optional(),
  county: z.string().max(128).optional(),
  isActiveMilitary: z.boolean().optional(),
  isDraft: z.boolean().optional(),
  gender: z.string().max(32).optional(),
  dob: dateString,
  ssn: z.string().regex(/^\d{9}$/).optional(),
  leadSource: z.string().max(200).optional(),
  leadType: z.string().max(64).optional(),
  leadCampaign: z.string().max(200).optional(),
  leadMedium: z.string().max(200).optional(),
  status: customerStatusSchema.optional(),
  assignedTo: z.string().uuid().optional(),
  bdcRepId: z.string().uuid().optional(),
  idType: z.string().max(64).optional(),
  idState: z.string().max(32).optional(),
  idNumber: z.string().max(128).optional(),
  idIssuedDate: dateString,
  idExpirationDate: dateString,
  cashDownCents: centsString,
  isInShowroom: z.boolean().optional(),
  addressLine1: z.string().max(500).optional(),
  addressLine2: z.string().max(500).optional(),
  city: z.string().max(200).optional(),
  region: z.string().max(200).optional(),
  postalCode: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  tags: z.array(z.string().max(100)).optional(),
  phones: z.array(phoneInputSchema).optional(),
  emails: z.array(emailInputSchema).optional(),
});

export const updateCustomerBodySchema = createCustomerBodySchema.partial();

export const customerIdParamSchema = z.object({ id: z.string().uuid() });

const PAGINATION_LIMIT_1_50 = z.coerce.number().int().min(1).max(50);
const PAGINATION_OFFSET = z.coerce.number().int().min(0);

export const listNotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const timelineTypeSchema = z.enum(["NOTE", "CALL", "CALLBACK", "APPOINTMENT", "SYSTEM"]);
export const timelineQuerySchema = z.object({
  limit: PAGINATION_LIMIT_1_50.default(25),
  offset: PAGINATION_OFFSET.default(0),
  type: timelineTypeSchema.optional(),
});

export const logCallBodySchema = z.object({
  summary: z.string().max(500).optional().nullable(),
  durationSeconds: z.number().int().min(0).optional().nullable(),
  direction: z.string().max(50).optional().nullable(),
});

export const customerCallbackStatusSchema = z.enum(["SCHEDULED", "DONE", "CANCELLED"]);
export const listCallbacksQuerySchema = z.object({
  status: customerCallbackStatusSchema.optional(),
  limit: PAGINATION_LIMIT_1_50.default(25),
  offset: PAGINATION_OFFSET.default(0),
});
export const createCallbackBodySchema = z.object({
  callbackAt: z.string().datetime(),
  reason: z.string().max(2000).optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
});
export const updateCallbackBodySchema = z
  .object({
    status: customerCallbackStatusSchema.optional(),
    snoozedUntil: z.string().datetime().optional().nullable(),
  })
  .refine((v) => v.status !== undefined || v.snoozedUntil !== undefined, {
    message: "At least one of status or snoozedUntil is required",
  });
export const callbackIdParamSchema = z.object({
  id: z.string().uuid(),
  callbackId: z.string().uuid(),
});

export const createNoteBodySchema = z.object({
  body: z.string().min(1).max(10000),
});

export const updateNoteBodySchema = z.object({
  body: z.string().min(1).max(10000).optional(),
});

export const noteIdParamSchema = z.object({
  id: z.string().uuid(),
  noteId: z.string().uuid(),
});

export const listTasksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  completed: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

export const createTaskBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  dueAt: z.string().datetime().optional(),
});

export const updateTaskBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
  completedBy: z.string().uuid().optional().nullable(),
});

export const taskIdParamSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const listActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

// --- Lead Action Strip (sprint4) ---
const PII_METADATA_KEYS = [
  "email",
  "phone",
  "messagebody",
  "message",
  "body",
  "name",
  "content",
  "text",
] as const;

function hasPiiMetadataKeys(meta: Record<string, unknown> | undefined): boolean {
  if (!meta || typeof meta !== "object") return false;
  const keys = Object.keys(meta).map((k) => k.toLowerCase());
  return keys.some((k) => PII_METADATA_KEYS.includes(k as (typeof PII_METADATA_KEYS)[number]));
}

export const activityTypeSchema = z.enum([
  "sms_sent",
  "appointment_scheduled",
  "disposition_set",
  "task_created",
]);

export const createActivityBodySchema = z
  .object({
    activityType: activityTypeSchema,
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((v) => !hasPiiMetadataKeys(v.metadata), {
    message: "metadata must not contain PII keys (e.g. email, phone, messageBody)",
    path: ["metadata"],
  });

export const dispositionBodySchema = z.object({
  status: customerStatusSchema,
  followUpTask: z
    .object({
      title: z.string().min(1).max(500),
      dueAt: z.string().datetime().optional(),
    })
    .optional(),
});

export const appointmentStubBodySchema = z.object({
  scheduledAt: z.string().datetime(),
  notes: z.string().max(5000).optional(),
});

export const smsStubBodySchema = z.object({
  message: z.string().max(10000).optional(),
});
