import { prisma } from "@/lib/db";
import { labelQueryFamily } from "@/lib/request-context";

export type CustomerLastActivitySummaryRow = {
  id: string;
  name: string;
  lastActivityAt: Date;
  daysSinceActivity: number;
};

export async function upsertCustomerLastActivitySummary(
  dealershipId: string,
  customerId: string,
  lastActivityAt: Date
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "customer_last_activity_summary" (
      "id",
      "dealership_id",
      "customer_id",
      "last_activity_at",
      "computed_at",
      "updated_at"
    )
    VALUES (
      ${customerId}::uuid,
      ${dealershipId}::uuid,
      ${customerId}::uuid,
      ${lastActivityAt},
      NOW(),
      NOW()
    )
    ON CONFLICT ("dealership_id", "customer_id")
    DO UPDATE SET
      "last_activity_at" = GREATEST(
        "customer_last_activity_summary"."last_activity_at",
        EXCLUDED."last_activity_at"
      ),
      "computed_at" = NOW(),
      "updated_at" = NOW()
  `;
}

export async function backfillCustomerLastActivitySummaries(
  dealershipId: string
): Promise<void> {
  labelQueryFamily("customers.last-activity-summary.backfill");
  await prisma.$executeRaw`
    INSERT INTO "customer_last_activity_summary" (
      "id",
      "dealership_id",
      "customer_id",
      "last_activity_at",
      "computed_at",
      "updated_at"
    )
    WITH activity_max AS (
      SELECT ca.customer_id, MAX(ca.created_at) AS max_at
      FROM "CustomerActivity" ca
      WHERE ca.dealership_id = ${dealershipId}::uuid
      GROUP BY ca.customer_id
    ),
    note_max AS (
      SELECT cn.customer_id, MAX(cn.created_at) AS max_at
      FROM "CustomerNote" cn
      WHERE cn.dealership_id = ${dealershipId}::uuid
        AND cn.deleted_at IS NULL
      GROUP BY cn.customer_id
    ),
    task_max AS (
      SELECT
        ct.customer_id,
        MAX(GREATEST(
          ct.created_at,
          ct.updated_at,
          COALESCE(ct.completed_at, ct.created_at)
        )) AS max_at
      FROM "CustomerTask" ct
      WHERE ct.dealership_id = ${dealershipId}::uuid
      GROUP BY ct.customer_id
    )
    SELECT
      c.id,
      c.dealership_id,
      c.id,
      GREATEST(
        c.created_at,
        c.updated_at,
        COALESCE(am.max_at, c.created_at),
        COALESCE(nm.max_at, c.created_at),
        COALESCE(tm.max_at, c.created_at)
      ) AS last_activity_at,
      NOW(),
      NOW()
    FROM "Customer" c
    LEFT JOIN activity_max am ON am.customer_id = c.id
    LEFT JOIN note_max nm ON nm.customer_id = c.id
    LEFT JOIN task_max tm ON tm.customer_id = c.id
    WHERE c.dealership_id = ${dealershipId}::uuid
      AND c.deleted_at IS NULL
      AND c.is_draft = false
    ON CONFLICT ("dealership_id", "customer_id")
    DO UPDATE SET
      "last_activity_at" = EXCLUDED."last_activity_at",
      "computed_at" = NOW(),
      "updated_at" = NOW()
  `;
}

export async function countCustomerLastActivitySummaries(
  dealershipId: string
): Promise<number> {
  return prisma.customerLastActivitySummary.count({
    where: { dealershipId },
  });
}

export async function listStaleLeadSummaries(
  dealershipId: string,
  daysThreshold: number,
  limit: number
): Promise<CustomerLastActivitySummaryRow[]> {
  labelQueryFamily("customers.stale-leads.summary-list");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);
  cutoff.setHours(0, 0, 0, 0);

  const rows = await prisma.customerLastActivitySummary.findMany({
    where: {
      dealershipId,
      lastActivityAt: { lt: cutoff },
      customer: {
        deletedAt: null,
        isDraft: false,
      },
    },
    orderBy: { lastActivityAt: "asc" },
    take: limit,
    select: {
      customerId: true,
      lastActivityAt: true,
      customer: { select: { name: true } },
    },
  });

  const now = Date.now();
  return rows.map((row) => ({
    id: row.customerId,
    name: row.customer.name,
    lastActivityAt: row.lastActivityAt,
    daysSinceActivity: Math.floor((now - row.lastActivityAt.getTime()) / 86_400_000),
  }));
}

export async function getStaleLeadSummaryStats(
  dealershipId: string,
  daysThreshold: number
): Promise<{ staleLeadCount: number; oldestStaleLeadAgeDays: number | null }> {
  labelQueryFamily("customers.stale-leads.summary-stats");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);
  cutoff.setHours(0, 0, 0, 0);

  const [staleLeadCount, oldestRow] = await Promise.all([
    prisma.customerLastActivitySummary.count({
      where: {
        dealershipId,
        lastActivityAt: { lt: cutoff },
        customer: {
          deletedAt: null,
          isDraft: false,
        },
      },
    }),
    prisma.customerLastActivitySummary.findFirst({
      where: {
        dealershipId,
        lastActivityAt: { lt: cutoff },
        customer: {
          deletedAt: null,
          isDraft: false,
        },
      },
      orderBy: { lastActivityAt: "asc" },
      select: { lastActivityAt: true },
    }),
  ]);

  return {
    staleLeadCount,
    oldestStaleLeadAgeDays: oldestRow
      ? Math.floor((Date.now() - oldestRow.lastActivityAt.getTime()) / 86_400_000)
      : null,
  };
}
