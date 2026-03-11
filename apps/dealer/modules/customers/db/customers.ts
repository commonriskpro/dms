import { prisma } from "@/lib/db";
import type { CustomerStatus } from "@prisma/client";
import { MS_PER_DAY, startOfTodayUtc } from "@/lib/db/date-utils";
import { softDeleteData } from "@/lib/db/update-helpers";
import { paginatedQuery } from "@/lib/db/paginate";
import { PROFILE_SELECT } from "@/lib/db/common-selects";

export type CustomerListFilters = {
  status?: CustomerStatus;
  leadSource?: string;
  assignedTo?: string;
  search?: string;
};

export type CustomerListSort = {
  sortBy: "created_at" | "updated_at" | "status";
  sortOrder: "asc" | "desc";
};

export type CustomerListOptions = {
  limit: number;
  offset: number;
  filters?: CustomerListFilters;
  sort?: CustomerListSort;
};

export type CustomerCreateInput = {
  name: string;
  leadSource?: string | null;
  leadCampaign?: string | null;
  leadMedium?: string | null;
  status?: CustomerStatus;
  assignedTo?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  tags?: string[];
  phones?: { kind?: string | null; value: string; isPrimary?: boolean }[];
  emails?: { kind?: string | null; value: string; isPrimary?: boolean }[];
};

export type CustomerUpdateInput = Partial<Omit<CustomerCreateInput, "phones" | "emails">> & {
  phones?: { kind?: string | null; value: string; isPrimary?: boolean }[];
  emails?: { kind?: string | null; value: string; isPrimary?: boolean }[];
};

function normalizePrimaries(
  items: { kind?: string | null; value: string; isPrimary?: boolean }[]
): { kind?: string | null; value: string; isPrimary: boolean }[] {
  let foundPrimary = false;
  return items.map((item, i) => {
    const isPrimary = item.isPrimary === true || (!foundPrimary && i === 0);
    if (isPrimary) foundPrimary = true;
    return { ...item, isPrimary };
  });
}

export async function listCustomers(dealershipId: string, options: CustomerListOptions) {
  const { limit, offset, filters = {}, sort } = options;
  const search = filters.search?.trim();
  const where = {
    dealershipId,
    deletedAt: null,
    ...(filters.status && { status: filters.status }),
    ...(filters.leadSource && { leadSource: filters.leadSource }),
    ...(filters.assignedTo && { assignedTo: filters.assignedTo }),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phones: { some: { value: { contains: search, mode: "insensitive" as const } } } },
            { emails: { some: { value: { contains: search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const sortBy = sort?.sortBy ?? "created_at";
  const sortOrder = sort?.sortOrder ?? "desc";
  const prismaSortBy =
    sortBy === "created_at" ? "createdAt" : sortBy === "updated_at" ? "updatedAt" : sortBy;
  const orderBy = { [prismaSortBy]: sortOrder } as {
    createdAt?: "asc" | "desc";
    updatedAt?: "asc" | "desc";
    status?: "asc" | "desc";
  };
  return paginatedQuery(
    () =>
      prisma.customer.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          phones: true,
          emails: true,
          assignedToProfile: { select: PROFILE_SELECT },
        },
      }),
    () => prisma.customer.count({ where })
  );
}

export async function getCustomerById(dealershipId: string, id: string) {
  return prisma.customer.findFirst({
    where: { id, dealershipId, deletedAt: null },
    include: {
      phones: true,
      emails: true,
      assignedToProfile: { select: { id: true, fullName: true, email: true } },
      stage: { select: { id: true, name: true, order: true, colorKey: true, pipelineId: true } },
    },
  });
}

export async function updateCustomerStageId(
  dealershipId: string,
  customerId: string,
  stageId: string | null
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  return prisma.customer.update({
    where: { id: customerId },
    data: { stageId },
    include: {
      stage: { select: { id: true, name: true, order: true, colorKey: true, pipelineId: true } },
    },
  });
}

/** Count customer tasks that are overdue: dueAt < start of today, not completed, not deleted. */
export async function countOverdueTasksForCustomer(
  dealershipId: string,
  customerId: string
): Promise<number> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return prisma.customerTask.count({
    where: {
      dealershipId,
      customerId,
      deletedAt: null,
      completedAt: null,
      dueAt: { lt: startOfToday },
    },
  });
}

/** Count customers by status (for dashboard pipeline leads). */
export async function countCustomersByStatus(
  dealershipId: string,
  status: CustomerStatus
): Promise<number> {
  return prisma.customer.count({
    where: { dealershipId, deletedAt: null, status },
  });
}

export async function createCustomer(dealershipId: string, data: CustomerCreateInput) {
  const phones = normalizePrimaries(data.phones ?? []);
  const emails = normalizePrimaries(data.emails ?? []);

  const customer = await prisma.$transaction(async (tx) => {
    const c = await tx.customer.create({
      data: {
        dealershipId,
        name: data.name,
        leadSource: data.leadSource ?? null,
        leadCampaign: data.leadCampaign ?? null,
        leadMedium: data.leadMedium ?? null,
        status: data.status ?? "LEAD",
        assignedTo: data.assignedTo ?? null,
        addressLine1: data.addressLine1 ?? null,
        addressLine2: data.addressLine2 ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        postalCode: data.postalCode ?? null,
        country: data.country ?? null,
        tags: data.tags ?? [],
      },
    });
    if (phones.length) {
      await tx.customerPhone.createMany({
        data: phones.map((p) => ({
          dealershipId,
          customerId: c.id,
          kind: p.kind ?? null,
          value: p.value,
          isPrimary: p.isPrimary,
        })),
      });
    }
    if (emails.length) {
      await tx.customerEmail.createMany({
        data: emails.map((e) => ({
          dealershipId,
          customerId: c.id,
          kind: e.kind ?? null,
          value: e.value,
          isPrimary: e.isPrimary,
        })),
      });
    }
    return c;
  });

  const withRelations = await getCustomerById(dealershipId, customer.id);
  if (!withRelations) throw new Error("Customer not found after create");
  return withRelations;
}

export async function updateCustomer(
  dealershipId: string,
  id: string,
  data: CustomerUpdateInput
) {
  const existing = await prisma.customer.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
  if (!existing) return null;

  const phones = data.phones !== undefined ? normalizePrimaries(data.phones) : undefined;
  const emails = data.emails !== undefined ? normalizePrimaries(data.emails) : undefined;

  await prisma.$transaction(async (tx) => {
    const updatePayload: Record<string, unknown> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.leadSource !== undefined) updatePayload.leadSource = data.leadSource ?? null;
    if (data.leadCampaign !== undefined) updatePayload.leadCampaign = data.leadCampaign ?? null;
    if (data.leadMedium !== undefined) updatePayload.leadMedium = data.leadMedium ?? null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.assignedTo !== undefined) updatePayload.assignedTo = data.assignedTo ?? null;
    if (data.addressLine1 !== undefined) updatePayload.addressLine1 = data.addressLine1 ?? null;
    if (data.addressLine2 !== undefined) updatePayload.addressLine2 = data.addressLine2 ?? null;
    if (data.city !== undefined) updatePayload.city = data.city ?? null;
    if (data.region !== undefined) updatePayload.region = data.region ?? null;
    if (data.postalCode !== undefined) updatePayload.postalCode = data.postalCode ?? null;
    if (data.country !== undefined) updatePayload.country = data.country ?? null;
    if (data.tags !== undefined) updatePayload.tags = data.tags;

    if (Object.keys(updatePayload).length) {
      await tx.customer.update({ where: { id }, data: updatePayload });
    }
    if (phones !== undefined) {
      await tx.customerPhone.deleteMany({ where: { customerId: id, dealershipId } });
      if (phones.length) {
        await tx.customerPhone.createMany({
          data: phones.map((p) => ({
            dealershipId,
            customerId: id,
            kind: p.kind ?? null,
            value: p.value,
            isPrimary: p.isPrimary,
          })),
        });
      }
    }
    if (emails !== undefined) {
      await tx.customerEmail.deleteMany({ where: { customerId: id, dealershipId } });
      if (emails.length) {
        await tx.customerEmail.createMany({
          data: emails.map((e) => ({
            dealershipId,
            customerId: id,
            kind: e.kind ?? null,
            value: e.value,
            isPrimary: e.isPrimary,
          })),
        });
      }
    }
  });

  return getCustomerById(dealershipId, id);
}

export type LeadSourceRow = { source: string | null; campaign: string | null; medium: string | null };

export async function listLeadSourceValues(
  dealershipId: string,
  options: { limit: number }
): Promise<LeadSourceRow[]> {
  const rows = await prisma.customer.findMany({
    where: { dealershipId, deletedAt: null },
    select: {
      leadSource: true,
      leadCampaign: true,
      leadMedium: true,
    },
    distinct: ["leadSource", "leadCampaign", "leadMedium"],
    orderBy: [{ leadSource: "asc" }, { leadCampaign: "asc" }, { leadMedium: "asc" }],
    take: Math.min(options.limit, 100),
  });
  return rows.map((r) => ({
    source: r.leadSource ?? null,
    campaign: r.leadCampaign ?? null,
    medium: r.leadMedium ?? null,
  }));
}

export async function softDeleteCustomer(
  dealershipId: string,
  customerId: string,
  actorId: string
) {
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, dealershipId, deletedAt: null },
  });
  if (!existing) return null;
  await prisma.customer.update({
    where: { id: customerId },
    data: softDeleteData(actorId),
  });
  return existing;
}

export type CustomerMetrics = {
  newLeadsToday: number;
  leadsThisWeek: number;
  byStatus: Record<string, number>;
  tasksDueToday: number;
};

/** Five-card summary for customers list page. All counts scoped by dealershipId. */
export type CustomerSummaryMetrics = {
  totalCustomers: number;
  totalLeads: number;
  activeCustomers: number;
  activeCount: number;
  inactiveCustomers: number;
  soldCount: number;
  recentlyContacted: number;
  callbacksToday: number;
  newThisWeek: number;
};

export async function getCustomerSummaryMetrics(
  dealershipId: string
): Promise<CustomerSummaryMetrics> {
  const baseWhere = { dealershipId, deletedAt: null };
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [rows, recentlyContacted, callbacksToday, newThisWeek] = await Promise.all([
    prisma.customer.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { id: true },
    }),
    prisma.customer.count({
      where: { ...baseWhere, lastVisitAt: { gte: sevenDaysAgo } },
    }),
    prisma.customerCallback.count({
      where: {
        dealershipId,
        status: "SCHEDULED",
        callbackAt: { gte: startOfDay, lt: endOfDay },
      },
    }),
    prisma.customer.count({
      where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = row._count.id;
  }
  const totalLeads = byStatus.LEAD ?? 0;
  const activeCustomers = byStatus.ACTIVE ?? 0;
  const inactiveCustomers = byStatus.INACTIVE ?? 0;
  const sold = byStatus.SOLD ?? 0;
  const totalCustomers = totalLeads + activeCustomers + inactiveCustomers + sold;
  return {
    totalCustomers,
    totalLeads,
    activeCustomers,
    activeCount: activeCustomers,
    inactiveCustomers,
    soldCount: sold,
    recentlyContacted,
    callbacksToday,
    newThisWeek,
  };
}

/**
 * Resolve customer by primary phone (for inbound SMS webhook). Returns first customer with
 * primary phone whose digits match; tenant comes from that customer.
 */
export async function getCustomerIdAndDealershipByPrimaryPhone(
  phoneValue: string
): Promise<{ customerId: string; dealershipId: string } | null> {
  const digits = phoneValue.replace(/\D/g, "");
  if (!digits.length) return null;
  const rows = await prisma.$queryRaw<
    { customer_id: string; dealership_id: string }[]
  >`
    SELECT cp.customer_id, c.dealership_id
    FROM "CustomerPhone" cp
    INNER JOIN "Customer" c ON c.id = cp.customer_id AND c.deleted_at IS NULL
    WHERE cp.is_primary = true
      AND regexp_replace(cp.value, '[^0-9]', '', 'g') = ${digits}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { customerId: row.customer_id, dealershipId: row.dealership_id };
}

/**
 * Resolve customer by primary email (for inbound email webhook). Returns first customer with
 * matching primary email (case-insensitive); tenant comes from that customer.
 */
export async function getCustomerIdAndDealershipByPrimaryEmail(
  email: string
): Promise<{ customerId: string; dealershipId: string } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const row = await prisma.customerEmail.findFirst({
    where: { isPrimary: true, value: { equals: normalized, mode: "insensitive" } },
    select: { customerId: true, customer: { select: { dealershipId: true } } },
  });
  if (!row) return null;
  return {
    customerId: row.customerId,
    dealershipId: row.customer.dealershipId,
  };
}

/** Typeahead search: match q on name, any phone value, or any email value. Returns id, name, primaryPhone, primaryEmail. */
export async function searchCustomersByTerm(
  dealershipId: string,
  q: string,
  limit: number
): Promise<
  { id: string; name: string; primaryPhone: string | null; primaryEmail: string | null }[]
> {
  const term = q.trim();
  if (!term) return [];
  const where = {
    dealershipId,
    deletedAt: null,
    OR: [
      { name: { contains: term, mode: "insensitive" as const } },
      { phones: { some: { value: { contains: term, mode: "insensitive" as const } } } },
      { emails: { some: { value: { contains: term, mode: "insensitive" as const } } } },
    ],
  };
  const rows = await prisma.customer.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      phones: { orderBy: { isPrimary: "desc" }, take: 1 },
      emails: { orderBy: { isPrimary: "desc" }, take: 1 },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    primaryPhone: c.phones[0]?.value ?? null,
    primaryEmail: c.emails[0]?.value ?? null,
  }));
}

/** Dashboard: customers with status=LEAD, ordered by createdAt desc. */
export async function listNewProspects(
  dealershipId: string,
  limit: number
): Promise<
  { id: string; name: string; createdAt: Date; primaryPhone: string | null; primaryEmail: string | null }[]
> {
  const rows = await prisma.customer.findMany({
    where: { dealershipId, deletedAt: null, status: "LEAD" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      phones: { orderBy: { isPrimary: "desc" }, take: 1 },
      emails: { orderBy: { isPrimary: "desc" }, take: 1 },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: c.createdAt,
    primaryPhone: c.phones[0]?.value ?? null,
    primaryEmail: c.emails[0]?.value ?? null,
  }));
}

/** Dashboard: customers with no activity for more than daysThreshold days. Last activity = max of activity, notes, tasks (create/update/complete); fallback customer.updatedAt/createdAt. */
export async function listStaleLeads(
  dealershipId: string,
  daysThreshold: number,
  limit: number
): Promise<
  { id: string; name: string; lastActivityAt: Date; daysSinceActivity: number }[]
> {
  const staleLeads = await loadStaleLeadRows(dealershipId, daysThreshold);
  return staleLeads.slice(0, limit);
}

export async function getStaleLeadStats(
  dealershipId: string,
  daysThreshold: number
): Promise<{ staleLeadCount: number; oldestStaleLeadAgeDays: number | null }> {
  const staleLeads = await loadStaleLeadRows(dealershipId, daysThreshold);
  return {
    staleLeadCount: staleLeads.length,
    oldestStaleLeadAgeDays: staleLeads[0]?.daysSinceActivity ?? null,
  };
}

async function loadStaleLeadRows(
  dealershipId: string,
  daysThreshold: number
): Promise<{ id: string; name: string; lastActivityAt: Date; daysSinceActivity: number }[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysThreshold);
  cutoff.setHours(0, 0, 0, 0);

  const [customers, activityMax, noteMax, tasks] = await Promise.all([
    prisma.customer.findMany({
      where: { dealershipId, deletedAt: null },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    }),
    prisma.customerActivity.groupBy({
      by: ["customerId"],
      where: { dealershipId },
      _max: { createdAt: true },
    }),
    prisma.customerNote.groupBy({
      by: ["customerId"],
      where: { dealershipId, deletedAt: null },
      _max: { createdAt: true },
    }),
    prisma.customerTask.findMany({
      where: { dealershipId },
      select: {
        customerId: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    }),
  ]);

  const activityByCustomer = new Map<string, Date>();
  for (const row of activityMax) {
    if (row._max.createdAt) activityByCustomer.set(row.customerId, row._max.createdAt);
  }
  const noteByCustomer = new Map<string, Date>();
  for (const row of noteMax) {
    if (row._max.createdAt) noteByCustomer.set(row.customerId, row._max.createdAt);
  }
  const taskByCustomer = new Map<string, Date>();
  for (const t of tasks) {
    const dates = [t.createdAt, t.updatedAt, t.completedAt].filter(Boolean) as Date[];
    const maxTask = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    if (maxTask) {
      const existing = taskByCustomer.get(t.customerId);
      if (!existing || maxTask > existing) taskByCustomer.set(t.customerId, maxTask);
    }
  }

  const now = new Date();
  const withLastActivity = customers
    .map((c) => {
      const activity = activityByCustomer.get(c.id);
      const note = noteByCustomer.get(c.id);
      const task = taskByCustomer.get(c.id);
      const dates = [c.updatedAt, c.createdAt, activity, note, task].filter(
        (d): d is Date => d != null
      );
      const lastActivityAt =
        dates.length > 0
          ? new Date(Math.max(...dates.map((d) => d.getTime())))
          : c.createdAt;
      const daysSinceActivity = Math.floor(
        (now.getTime() - lastActivityAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      return { ...c, lastActivityAt, daysSinceActivity };
    })
    .filter((c) => c.lastActivityAt < cutoff)
    .sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime())
    ;

  return withLastActivity.map((c) => ({
    id: c.id,
    name: c.name,
    lastActivityAt: c.lastActivityAt,
    daysSinceActivity: c.daysSinceActivity,
  }));
}

export async function getCustomerMetrics(dealershipId: string): Promise<CustomerMetrics> {
  const now = new Date();
  const startOfToday = startOfTodayUtc();
  const endOfToday = new Date(startOfToday.getTime() + MS_PER_DAY);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const baseWhere = { dealershipId, deletedAt: null };

  const [newLeadsToday, leadsThisWeek, byStatusRows, tasksDueToday] = await Promise.all([
    prisma.customer.count({
      where: {
        ...baseWhere,
        status: "LEAD",
        createdAt: { gte: startOfToday, lt: endOfToday },
      },
    }),
    prisma.customer.count({
      where: {
        ...baseWhere,
        status: "LEAD",
        createdAt: { gte: startOfWeek },
      },
    }),
    prisma.customer.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { id: true },
    }),
    prisma.customerTask.count({
      where: {
        dealershipId,
        deletedAt: null,
        completedAt: null,
        dueAt: { gte: startOfToday, lt: endOfToday },
      },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRows) {
    byStatus[row.status] = row._count.id;
  }

  return {
    newLeadsToday,
    leadsThisWeek,
    byStatus,
    tasksDueToday,
  };
}
