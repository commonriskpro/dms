import * as customersDb from "../db/customers";
import * as activityDb from "../db/activity";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type ActivityListOptions = { limit: number; offset: number };

const ALLOWED_ACTIVITY_TYPES = [
  "sms_sent",
  "email_sent",
  "appointment_scheduled",
  "disposition_set",
  "task_created",
] as const;

export async function listActivity(
  dealershipId: string,
  customerId: string,
  options: ActivityListOptions
) {
  await requireTenantActiveForRead(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  return activityDb.listActivity(dealershipId, customerId, options);
}

export async function createActivity(
  dealershipId: string,
  userId: string,
  customerId: string,
  data: { activityType: string; metadata?: Record<string, unknown> }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  if (!ALLOWED_ACTIVITY_TYPES.includes(data.activityType as (typeof ALLOWED_ACTIVITY_TYPES)[number])) {
    throw new ApiError("VALIDATION_ERROR", "Invalid activityType");
  }
  const metadata = data.metadata ?? null;
  const created = await activityDb.appendActivity(
    dealershipId,
    customerId,
    data.activityType,
    "Customer",
    customerId,
    metadata,
    userId
  );
  return created;
}

/** SMS stub: log activity only; message/phone must not be stored in metadata. */
export async function logSmsSent(dealershipId: string, userId: string, customerId: string) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  return activityDb.appendActivity(
    dealershipId,
    customerId,
    "sms_sent",
    "Customer",
    customerId,
    {},
    userId
  );
}

/** Log a sent message (SMS or email) with direction and truncated content preview. No PII (phone/email/body) in metadata. */
export async function logMessageSent(
  dealershipId: string,
  userId: string,
  customerId: string,
  activityType: "sms_sent" | "email_sent",
  metadata: {
    direction: "inbound" | "outbound";
    contentPreview?: string;
    channel?: "sms" | "email";
    providerMessageId?: string | null;
    provider?: string | null;
    deliveryStatus?: string | null;
  }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const safeMeta: Record<string, unknown> = {
    direction: metadata.direction,
    channel: metadata.channel ?? (activityType === "sms_sent" ? "sms" : "email"),
  };
  if (metadata.contentPreview != null && metadata.contentPreview.length > 0) {
    safeMeta.contentPreview = metadata.contentPreview.slice(0, 80);
  }
  return activityDb.appendActivity(
    dealershipId,
    customerId,
    activityType,
    "Customer",
    customerId,
    safeMeta,
    userId,
    {
      providerMessageId: metadata.providerMessageId ?? null,
      deliveryStatus: metadata.deliveryStatus ?? null,
      provider: metadata.provider ?? null,
    }
  );
}

/** Appointment stub: log activity with scheduledAt and optional truncated notes (no PII). */
export async function logAppointmentScheduled(
  dealershipId: string,
  userId: string,
  customerId: string,
  data: { scheduledAt: string; notes?: string | null }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const metadata: Record<string, unknown> = { scheduledAt: data.scheduledAt };
  if (data.notes != null && data.notes !== "") {
    metadata.notesTruncated = data.notes.slice(0, 50);
  }
  return activityDb.appendActivity(
    dealershipId,
    customerId,
    "appointment_scheduled",
    "Customer",
    customerId,
    metadata,
    userId
  );
}

/**
 * Log an inbound message (SMS or email). Called from webhooks after resolving customer.
 * No session check; caller must have resolved dealershipId from customer lookup.
 */
export async function logInboundMessage(
  dealershipId: string,
  customerId: string,
  activityType: "sms_sent" | "email_sent",
  data: {
    contentPreview?: string;
    channel: "sms" | "email";
    providerMessageId?: string | null;
    provider?: string | null;
  }
) {
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const safeMeta: Record<string, unknown> = {
    direction: "inbound",
    channel: data.channel,
  };
  if (data.contentPreview != null && data.contentPreview.length > 0) {
    safeMeta.contentPreview = data.contentPreview.slice(0, 80);
  }
  return activityDb.appendActivity(
    dealershipId,
    customerId,
    activityType,
    "Customer",
    customerId,
    safeMeta,
    null,
    {
      providerMessageId: data.providerMessageId ?? null,
      provider: data.provider ?? null,
      deliveryStatus: null,
    }
  );
}

/** Update delivery status for a message activity (Twilio status callback). */
export async function updateMessageDeliveryStatus(
  providerMessageId: string,
  deliveryStatus: string,
  dealershipId?: string
) {
  const activity = dealershipId
    ? await activityDb.findActivityByProviderMessageId(dealershipId, providerMessageId)
    : await activityDb.findActivityByProviderMessageIdAny(providerMessageId);
  if (!activity) return null;
  await activityDb.updateActivityDeliveryStatus(
    activity.id,
    activity.dealershipId,
    deliveryStatus
  );
  return activity;
}

/** Log a call: creates CustomerActivity with activityType "call", entityType "call". Appears in timeline as CALL. */
export async function logCall(
  dealershipId: string,
  userId: string,
  customerId: string,
  data: { summary?: string | null; durationSeconds?: number | null; direction?: string | null }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const metadata: Record<string, unknown> = {};
  if (data.summary != null && data.summary !== "") metadata.summary = data.summary.slice(0, 500);
  if (data.durationSeconds != null) metadata.durationSeconds = data.durationSeconds;
  if (data.direction != null && data.direction !== "") metadata.direction = data.direction.slice(0, 50);
  const created = await activityDb.appendActivity(
    dealershipId,
    customerId,
    "call",
    "call",
    null,
    Object.keys(metadata).length ? metadata : null,
    userId
  );
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer_call.logged",
    entity: "CustomerActivity",
    entityId: created.id,
    metadata: { customerId, activityId: created.id },
  });
  return created;
}
