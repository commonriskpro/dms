import type { InboxChannel, InboxMessageDirection, InboxParticipantRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;

type EnsureConversationInput = {
  dealershipId: string;
  customerId: string;
  channel: InboxChannel;
  provider: string;
  providerThreadId: string;
  subject?: string | null;
  previewText?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

type EnsureParticipantInput = {
  dealershipId: string;
  conversationId: string;
  role: InboxParticipantRole;
  customerId?: string | null;
  profileId?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  providerUserId?: string | null;
  isPrimary?: boolean;
};

type CreateMessageInput = {
  dealershipId: string;
  conversationId: string;
  customerId?: string | null;
  channel: InboxChannel;
  direction: InboxMessageDirection;
  provider: string;
  providerMessageId?: string | null;
  providerThreadId?: string | null;
  senderParticipantId?: string | null;
  textBody?: string | null;
  bodyPreview?: string | null;
  normalizedPayloadJson?: Prisma.InputJsonValue | null;
  sentAt?: Date | null;
  receivedAt?: Date | null;
};

type CreateEventInput = {
  dealershipId: string;
  messageId: string;
  provider: string;
  eventType:
    | "QUEUED"
    | "SENT"
    | "DELIVERED"
    | "READ"
    | "FAILED"
    | "BOUNCED"
    | "OPENED"
    | "CLICKED"
    | "REPLIED";
  providerEventId?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
  occurredAt: Date;
};

export async function withInboxTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction((tx) => fn(tx));
}

export async function ensureConversation(tx: Tx, input: EnsureConversationInput) {
  return tx.inboxConversation.upsert({
    where: {
      dealershipId_provider_providerThreadId: {
        dealershipId: input.dealershipId,
        provider: input.provider,
        providerThreadId: input.providerThreadId,
      },
    },
    create: {
      dealershipId: input.dealershipId,
      customerId: input.customerId,
      channel: input.channel,
      provider: input.provider,
      providerThreadId: input.providerThreadId,
      externalSubject: input.subject ?? null,
      previewText: input.previewText ?? null,
      metadataJson: input.metadataJson ?? undefined,
      isResolved: true,
    },
    update: {
      customerId: input.customerId,
      channel: input.channel,
      externalSubject: input.subject ?? undefined,
      previewText: input.previewText ?? undefined,
      metadataJson: input.metadataJson ?? undefined,
      isResolved: true,
    },
  });
}

export async function ensureParticipant(tx: Tx, input: EnsureParticipantInput) {
  const existing = await tx.inboxParticipant.findFirst({
    where: {
      conversationId: input.conversationId,
      role: input.role,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.profileId ? { profileId: input.profileId } : {}),
      ...(input.providerUserId ? { providerUserId: input.providerUserId } : {}),
    },
  });

  if (existing) {
    return tx.inboxParticipant.update({
      where: { id: existing.id },
      data: {
        displayName: input.displayName ?? undefined,
        phone: input.phone ?? undefined,
        email: input.email ?? undefined,
        isPrimary: input.isPrimary ?? existing.isPrimary,
      },
    });
  }

  return tx.inboxParticipant.create({
    data: {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      role: input.role,
      customerId: input.customerId ?? null,
      profileId: input.profileId ?? null,
      displayName: input.displayName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      providerUserId: input.providerUserId ?? null,
      isPrimary: input.isPrimary ?? false,
    },
  });
}

export async function createMessage(tx: Tx, input: CreateMessageInput) {
  return tx.inboxMessage.create({
    data: {
      dealershipId: input.dealershipId,
      conversationId: input.conversationId,
      customerId: input.customerId ?? null,
      channel: input.channel,
      direction: input.direction,
      provider: input.provider,
      providerMessageId: input.providerMessageId ?? null,
      providerThreadId: input.providerThreadId ?? null,
      senderParticipantId: input.senderParticipantId ?? null,
      textBody: input.textBody ?? null,
      bodyPreview: input.bodyPreview ?? null,
      normalizedPayloadJson: input.normalizedPayloadJson ?? undefined,
      sentAt: input.sentAt ?? null,
      receivedAt: input.receivedAt ?? null,
    },
  });
}

export async function createMessageEvent(tx: Tx, input: CreateEventInput) {
  return tx.inboxMessageEvent.create({
    data: {
      dealershipId: input.dealershipId,
      messageId: input.messageId,
      provider: input.provider,
      eventType: input.eventType,
      providerEventId: input.providerEventId ?? null,
      metadataJson: input.metadataJson ?? undefined,
      occurredAt: input.occurredAt,
    },
  });
}

export async function refreshConversationAggregate(
  tx: Tx,
  params: {
    conversationId: string;
    previewText?: string | null;
    lastMessageId: string;
    direction: InboxMessageDirection;
    occurredAt: Date;
    subject?: string | null;
  }
) {
  return tx.inboxConversation.update({
    where: { id: params.conversationId },
    data: {
      previewText: params.previewText ?? undefined,
      externalSubject: params.subject ?? undefined,
      lastMessageId: params.lastMessageId,
      lastMessageAt: params.occurredAt,
      lastInboundAt: params.direction === "INBOUND" ? params.occurredAt : undefined,
      lastOutboundAt: params.direction === "OUTBOUND" ? params.occurredAt : undefined,
      waitingOn: params.direction === "INBOUND" ? "TEAM" : "CUSTOMER",
      unreadCount: params.direction === "INBOUND" ? { increment: 1 } : 0,
    },
  });
}

export async function findMessageByProviderMessageId(
  dealershipId: string,
  provider: string,
  providerMessageId: string
) {
  return prisma.inboxMessage.findFirst({
    where: {
      dealershipId,
      provider,
      providerMessageId,
    },
    orderBy: { createdAt: "desc" },
  });
}
