import type {
  InboxChannel,
  InboxMessageDirection,
  InboxMessageEventType,
  InboxMessageType,
} from "@prisma/client";

export type InboxResolvedIdentity = {
  dealershipId: string;
  customerId: string;
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type RecordInboxMessageInput = InboxResolvedIdentity & {
  channel: InboxChannel;
  provider: string;
  providerThreadId?: string | null;
  providerMessageId?: string | null;
  direction: InboxMessageDirection;
  messageType?: InboxMessageType;
  textBody?: string | null;
  bodyPreview?: string | null;
  subject?: string | null;
  senderUserId?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
};

export type AppendInboxMessageEventInput = {
  dealershipId: string;
  provider: string;
  providerMessageId: string;
  eventType: InboxMessageEventType;
  providerEventId?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
};
