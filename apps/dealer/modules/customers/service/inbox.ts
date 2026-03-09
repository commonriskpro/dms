/**
 * Inbox/conversation list: customers with recent SMS or email activity.
 */
import * as activityDb from "../db/activity";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

export type ConversationItem = {
  customerId: string;
  customerName: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  channel: "sms" | "email";
  direction: "inbound" | "outbound";
};

export type ListConversationsOptions = {
  limit: number;
  offset: number;
};

export type ListConversationsResult = {
  data: ConversationItem[];
  meta: { total: number; limit: number; offset: number };
};

/**
 * List conversations (customers with message activity), sorted by last message time.
 */
export async function listConversations(
  dealershipId: string,
  options: ListConversationsOptions
): Promise<ListConversationsResult> {
  await requireTenantActiveForRead(dealershipId);

  const { limit, offset } = options;
  const { rows, total } = await activityDb.listConversationsPage(
    dealershipId,
    limit,
    offset
  );

  const data: ConversationItem[] = rows.map((r) => ({
    customerId: r.customer_id,
    customerName: r.customer_name,
    lastMessagePreview: r.content_preview ?? "",
    lastMessageAt: r.last_message_at.toISOString(),
    channel: r.channel === "email" ? "email" : "sms",
    direction: r.direction === "inbound" ? "inbound" : "outbound",
  }));

  return {
    data,
    meta: { total, limit, offset },
  };
}
