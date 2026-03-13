import { Prisma } from "@prisma/client";
import type { InboxChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { labelQueryFamily } from "@/lib/request-context";

export type CanonicalConversationRow = {
  id: string;
  customerId: string;
  customerName: string;
  lastMessagePreview: string;
  lastMessageAt: Date;
  channel: "sms" | "email";
  direction: "inbound" | "outbound";
};

export async function hasCanonicalConversations(dealershipId: string): Promise<boolean> {
  const row = await prisma.inboxConversation.findFirst({
    where: {
      dealershipId,
      deletedAt: null,
      customerId: { not: null },
      customer: {
        deletedAt: null,
        isDraft: false,
      },
      channel: { in: ["SMS", "EMAIL"] },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function listCanonicalConversationsPage(
  dealershipId: string,
  limit: number,
  offset: number
): Promise<{ rows: CanonicalConversationRow[]; total: number; hasMore: boolean; totalIsExact: boolean }> {
  labelQueryFamily("crm.inbox.canonical-conversations");
  const rawRows = await prisma.$queryRaw<Array<{
    id: string;
    customerId: string;
    customerName: string;
    lastMessagePreview: string | null;
    lastMessageAt: Date;
    channel: InboxChannel;
    direction: "INBOUND" | "OUTBOUND" | null;
  }>>(Prisma.sql`
    WITH top_conversations AS (
      SELECT
        ic.id,
        ic.customer_id,
        ic.preview_text,
        ic.last_message_at,
        ic.last_message_id,
        ic.channel
      FROM "InboxConversation" ic
      WHERE ic.dealership_id = ${dealershipId}::uuid
        AND ic.deleted_at IS NULL
        AND ic.customer_id IS NOT NULL
        AND ic.channel IN ('SMS', 'EMAIL')
      ORDER BY ic.last_message_at DESC NULLS LAST, ic.created_at DESC
      LIMIT ${limit + 1}
      OFFSET ${offset}
    )
    SELECT
      tc.id,
      tc.customer_id AS "customerId",
      c.name AS "customerName",
      COALESCE(tc.preview_text, im.body_preview, im.text_body, '') AS "lastMessagePreview",
      tc.last_message_at AS "lastMessageAt",
      tc.channel,
      im.direction::text AS direction
    FROM top_conversations tc
    JOIN "Customer" c
      ON c.id = tc.customer_id
     AND c.deleted_at IS NULL
     AND c.is_draft = false
    LEFT JOIN "InboxMessage" im
      ON im.id = tc.last_message_id
    ORDER BY tc.last_message_at DESC NULLS LAST, tc.id ASC
  `);
  const hasMore = rawRows.length > limit;
  const rows = hasMore ? rawRows.slice(0, limit) : rawRows;
  const total = offset + rows.length + (hasMore ? 1 : 0);

  return {
    hasMore,
    total,
    totalIsExact: !hasMore,
    rows: rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      customerName: row.customerName,
      lastMessagePreview: row.lastMessagePreview ?? "",
      lastMessageAt: row.lastMessageAt,
      channel: row.channel === "EMAIL" ? "email" : "sms",
      direction: row.direction === "INBOUND" ? "inbound" : "outbound",
    })),
  };
}
