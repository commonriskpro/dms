import { prisma } from "@/lib/db";
import { labelQueryFamily } from "@/lib/request-context";
import { paginatedQuery } from "@/lib/db/paginate";

export type CanonicalInboxMessageRow = {
  id: string;
  conversationId: string;
  customerId: string | null;
  channel: "sms" | "email";
  direction: "inbound" | "outbound";
  textBody: string | null;
  bodyPreview: string | null;
  createdAt: Date;
};

export async function listCanonicalMessagesByCustomer(
  dealershipId: string,
  customerId: string,
  limit: number,
  offset: number
): Promise<{ data: CanonicalInboxMessageRow[]; total: number }> {
  labelQueryFamily("crm.inbox.canonical-thread");

  return paginatedQuery(
    () =>
      prisma.inboxMessage.findMany({
        where: {
          dealershipId,
          customerId,
          deletedAt: null,
          conversation: {
            deletedAt: null,
            customerId,
            customer: {
              deletedAt: null,
              isDraft: false,
            },
          },
          channel: { in: ["SMS", "EMAIL"] },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          conversationId: true,
          customerId: true,
          channel: true,
          direction: true,
          textBody: true,
          bodyPreview: true,
          createdAt: true,
        },
      }),
    () =>
      prisma.inboxMessage.count({
        where: {
          dealershipId,
          customerId,
          deletedAt: null,
          conversation: {
            deletedAt: null,
            customerId,
            customer: {
              deletedAt: null,
              isDraft: false,
            },
          },
          channel: { in: ["SMS", "EMAIL"] },
        },
      })
  ).then(({ data, total }) => ({
    total,
    data: data.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      customerId: row.customerId,
      channel: row.channel === "EMAIL" ? "email" : "sms",
      direction: row.direction === "INBOUND" ? "inbound" : "outbound",
      textBody: row.textBody,
      bodyPreview: row.bodyPreview,
      createdAt: row.createdAt,
    })),
  }));
}
