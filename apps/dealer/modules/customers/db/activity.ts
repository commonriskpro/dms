import { prisma } from "@/lib/db";
import { labelQueryFamily } from "@/lib/request-context";
import { upsertCustomerLastActivitySummary } from "./last-activity-summary";

export type ActivityListOptions = {
  limit: number;
  offset: number;
};

export type AppendMessageOptions = {
  providerMessageId?: string | null;
  deliveryStatus?: string | null;
  provider?: string | null;
};

export async function appendActivity(
  dealershipId: string,
  customerId: string,
  activityType: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> | null,
  actorId: string | null,
  messageOptions?: AppendMessageOptions
) {
  const created = await prisma.customerActivity.create({
    data: {
      dealershipId,
      customerId,
      activityType,
      entityType,
      entityId,
      metadata: metadata ? (metadata as object) : undefined,
      actorId,
      ...(messageOptions?.providerMessageId != null && {
        providerMessageId: messageOptions.providerMessageId,
      }),
      ...(messageOptions?.deliveryStatus != null && {
        deliveryStatus: messageOptions.deliveryStatus,
      }),
      ...(messageOptions?.provider != null && { provider: messageOptions.provider }),
    },
  });
  await upsertCustomerLastActivitySummary(
    dealershipId,
    customerId,
    created.createdAt
  );
  return created;
}

export async function listActivity(
  dealershipId: string,
  customerId: string,
  options: ActivityListOptions
) {
  labelQueryFamily("customers.activity.list");
  const { limit, offset } = options;
  const where = { dealershipId, customerId };
  const [data, total] = await Promise.all([
    prisma.customerActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.customerActivity.count({ where }),
  ]);
  return { data, total };
}

/** Count activities with given activityTypes created today (start of day UTC). For dashboard team activity. */
export async function countActivitiesByTypeToday(
  dealershipId: string,
  activityTypes: string[]
): Promise<number> {
  labelQueryFamily("customers.activity.today-count");
  if (activityTypes.length === 0) return 0;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return prisma.customerActivity.count({
    where: {
      dealershipId,
      createdAt: { gte: start },
      activityType: { in: activityTypes },
    },
  });
}

/** Find activity by provider message id (for status callbacks, scoped by tenant). */
export async function findActivityByProviderMessageId(
  dealershipId: string,
  providerMessageId: string
) {
  labelQueryFamily("customers.activity.provider-message.lookup");
  return prisma.customerActivity.findFirst({
    where: { dealershipId, providerMessageId },
  });
}

/** Find activity by provider message id only (for status callbacks when tenant unknown). */
export async function findActivityByProviderMessageIdAny(
  providerMessageId: string
) {
  labelQueryFamily("customers.activity.provider-message.lookup-any");
  return prisma.customerActivity.findFirst({
    where: { providerMessageId },
  });
}

/** Update delivery status for a message activity. */
export async function updateActivityDeliveryStatus(
  id: string,
  dealershipId: string,
  deliveryStatus: string
) {
  return prisma.customerActivity.updateMany({
    where: { id, dealershipId },
    data: { deliveryStatus },
  });
}

type ConversationRow = {
  customer_id: string;
  customer_name: string;
  last_message_at: Date;
  content_preview: string;
  channel: string;
  direction: string;
};

/** List one row per customer (latest message), ordered by last message desc, with pagination. */
export async function listConversationsPage(
  dealershipId: string,
  limit: number,
  offset: number
): Promise<{ rows: ConversationRow[]; total: number }> {
  labelQueryFamily("crm.inbox.legacy-conversations");
  const countRows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT customer_id)::bigint AS count
    FROM "CustomerActivity"
    WHERE dealership_id = ${dealershipId}::uuid
      AND activity_type IN ('sms_sent', 'email_sent')
  `;
  const total = Number(countRows[0]?.count ?? 0);

  const rows = await prisma.$queryRaw<ConversationRow[]>`
    WITH latest AS (
      SELECT DISTINCT ON (customer_id)
        customer_id, created_at, metadata
      FROM "CustomerActivity"
      WHERE dealership_id = ${dealershipId}::uuid
        AND activity_type IN ('sms_sent', 'email_sent')
      ORDER BY customer_id, created_at DESC
    )
    SELECT
      l.customer_id,
      c.name AS customer_name,
      l.created_at AS last_message_at,
      COALESCE((l.metadata->>'contentPreview')::text, '') AS content_preview,
      COALESCE(l.metadata->>'channel', 'sms') AS channel,
      COALESCE(l.metadata->>'direction', 'outbound') AS direction
    FROM latest l
    JOIN "Customer" c ON c.id = l.customer_id AND c.dealership_id = ${dealershipId}::uuid AND c.deleted_at IS NULL
    ORDER BY l.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  return { rows, total };
}
