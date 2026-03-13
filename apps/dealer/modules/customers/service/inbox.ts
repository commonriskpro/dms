/**
 * Inbox/conversation list: customers with recent SMS or email activity.
 */
import * as activityDb from "../db/activity";
import * as canonicalInboxDb from "@/modules/crm-inbox/db/conversations";
import { requireTenantActiveForRead } from "@/lib/tenant-status";
import { labelQueryFamily } from "@/lib/request-context";

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
  meta: { total: number; limit: number; offset: number; hasMore: boolean; totalIsExact: boolean };
};

/**
 * List conversations (customers with message activity), sorted by last message time.
 */
export async function listConversations(
  dealershipId: string,
  options: ListConversationsOptions
): Promise<ListConversationsResult> {
  labelQueryFamily("crm.inbox.list");
  await requireTenantActiveForRead(dealershipId);

  const { limit, offset } = options;
  const hasCanonicalConversations = await canonicalInboxDb.hasCanonicalConversations(dealershipId);
  const result =
    hasCanonicalConversations
      ? await canonicalInboxDb.listCanonicalConversationsPage(dealershipId, limit, offset)
      : await activityDb.listConversationsPage(dealershipId, limit, offset);
  const { rows, total } = result;

  const data: ConversationItem[] = rows.map((r) => ({
    customerId: "customer_id" in r ? r.customer_id : r.customerId,
    customerName: "customer_name" in r ? r.customer_name : r.customerName,
    lastMessagePreview: "content_preview" in r ? r.content_preview ?? "" : r.lastMessagePreview ?? "",
    lastMessageAt: ("last_message_at" in r ? r.last_message_at : r.lastMessageAt).toISOString(),
    channel: r.channel === "email" ? "email" : "sms",
    direction: r.direction === "inbound" ? "inbound" : "outbound",
  }));

  return {
    data,
    meta: {
      total,
      limit,
      offset,
      hasMore: "hasMore" in result ? result.hasMore : offset + rows.length < total,
      totalIsExact: "totalIsExact" in result ? result.totalIsExact : true,
    },
  };
}
