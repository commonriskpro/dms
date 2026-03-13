import type { InboxChannel, InboxMessageEventType, Prisma } from "@prisma/client";
import * as messagesDb from "@/modules/crm-inbox/db/messages";
import type {
  AppendInboxMessageEventInput,
  RecordInboxMessageInput,
} from "@/modules/crm-inbox/types";

const BODY_PREVIEW_MAX = 160;

function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "").trim();
  return digits.length > 0 ? digits : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function toProviderThreadId(
  channel: InboxChannel,
  phone: string | null | undefined,
  email: string | null | undefined,
  explicit: string | null | undefined
): string {
  const direct = explicit?.trim();
  if (direct) return direct;
  if (channel === "SMS" || channel === "WHATSAPP") {
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone) return normalizedPhone;
  }
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) return normalizedEmail;
  return `${channel.toLowerCase()}:customer:${Math.random().toString(36).slice(2)}`;
}

function buildPreview(textBody: string | null | undefined, fallback: string | null | undefined): string | null {
  const candidate = (textBody ?? fallback ?? "").replace(/\s+/g, " ").trim();
  if (!candidate) return null;
  return candidate.slice(0, BODY_PREVIEW_MAX);
}

function eventForDirection(direction: "INBOUND" | "OUTBOUND"): InboxMessageEventType {
  return direction === "INBOUND" ? "REPLIED" : "SENT";
}

function jsonOrUndefined(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
  return value == null ? undefined : (value as Prisma.InputJsonValue);
}

export async function recordCanonicalMessage(input: RecordInboxMessageInput) {
  const occurredAt = input.occurredAt ?? new Date();
  const providerThreadId = toProviderThreadId(
    input.channel,
    input.phone,
    input.email,
    input.providerThreadId
  );
  const previewText = buildPreview(input.textBody, input.bodyPreview ?? input.subject ?? null);

  return messagesDb.withInboxTx(async (tx) => {
    const conversation = await messagesDb.ensureConversation(tx, {
      dealershipId: input.dealershipId,
      customerId: input.customerId,
      channel: input.channel,
      provider: input.provider,
      providerThreadId,
      subject: input.subject ?? null,
      previewText,
      metadataJson: jsonOrUndefined(input.metadata),
    });

    const customerParticipant = await messagesDb.ensureParticipant(tx, {
      dealershipId: input.dealershipId,
      conversationId: conversation.id,
      role: "CUSTOMER",
      customerId: input.customerId,
      displayName: input.customerName ?? null,
      phone: normalizePhone(input.phone),
      email: normalizeEmail(input.email),
      isPrimary: true,
    });

    const senderParticipant =
      input.direction === "OUTBOUND" && input.senderUserId
        ? await messagesDb.ensureParticipant(tx, {
            dealershipId: input.dealershipId,
            conversationId: conversation.id,
            role: "REP",
            profileId: input.senderUserId,
            isPrimary: false,
          })
        : customerParticipant;

    const message = await messagesDb.createMessage(tx, {
      dealershipId: input.dealershipId,
      conversationId: conversation.id,
      customerId: input.customerId,
      channel: input.channel,
      direction: input.direction,
      provider: input.provider,
      providerMessageId: input.providerMessageId ?? null,
      providerThreadId,
      senderParticipantId: senderParticipant.id,
      textBody: input.textBody ?? null,
      bodyPreview: previewText,
      normalizedPayloadJson: jsonOrUndefined({
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.metadata ?? {}),
      }),
      sentAt: input.direction === "OUTBOUND" ? occurredAt : null,
      receivedAt: input.direction === "INBOUND" ? occurredAt : null,
    });

    await messagesDb.createMessageEvent(tx, {
      dealershipId: input.dealershipId,
      messageId: message.id,
      provider: input.provider,
      eventType: eventForDirection(input.direction),
      metadataJson: jsonOrUndefined(input.metadata),
      occurredAt,
    });

    await messagesDb.refreshConversationAggregate(tx, {
      conversationId: conversation.id,
      previewText,
      lastMessageId: message.id,
      direction: input.direction,
      occurredAt,
      subject: input.subject ?? null,
    });

    return { conversationId: conversation.id, messageId: message.id };
  });
}

function normalizeProviderEventType(provider: string, rawStatus: string): InboxMessageEventType {
  const status = rawStatus.trim().toLowerCase();
  if (provider === "twilio") {
    if (status === "queued") return "QUEUED";
    if (status === "sent") return "SENT";
    if (status === "delivered") return "DELIVERED";
    if (status === "read") return "READ";
    if (status === "failed" || status === "undelivered") return "FAILED";
  }
  if (provider === "sendgrid") {
    if (status === "processed" || status === "sent") return "SENT";
    if (status === "delivered") return "DELIVERED";
    if (status === "open" || status === "opened") return "OPENED";
    if (status === "click" || status === "clicked") return "CLICKED";
    if (status === "bounce" || status === "bounced" || status === "dropped") return "BOUNCED";
  }
  return "SENT";
}

export async function appendProviderMessageEvent(input: AppendInboxMessageEventInput) {
  const message = await messagesDb.findMessageByProviderMessageId(
    input.dealershipId,
    input.provider,
    input.providerMessageId
  );
  if (!message) return null;

  return messagesDb.withInboxTx(async (tx) => {
    return messagesDb.createMessageEvent(tx, {
      dealershipId: input.dealershipId,
      messageId: message.id,
      provider: input.provider,
      eventType: input.eventType,
      providerEventId: input.providerEventId ?? null,
      metadataJson: jsonOrUndefined(input.metadata),
      occurredAt: input.occurredAt ?? new Date(),
    });
  });
}

export async function appendProviderStatusEventByRawStatus(
  dealershipId: string,
  provider: string,
  providerMessageId: string,
  rawStatus: string,
  metadata?: Record<string, unknown> | null
) {
  return appendProviderMessageEvent({
    dealershipId,
    provider,
    providerMessageId,
    eventType: normalizeProviderEventType(provider, rawStatus),
    metadata: {
      rawStatus,
      ...(metadata ?? {}),
    },
  });
}
