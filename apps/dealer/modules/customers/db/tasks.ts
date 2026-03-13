import { prisma } from "@/lib/db";
import { upsertCustomerLastActivitySummary } from "./last-activity-summary";
import { labelQueryFamily } from "@/lib/request-context";

export type TaskListFilters = {
  completed?: boolean;
};

export type TaskListOptions = {
  limit: number;
  offset: number;
  filters?: TaskListFilters;
};

export async function listTasks(
  dealershipId: string,
  customerId: string,
  options: TaskListOptions
) {
  const { limit, offset, filters = {} } = options;
  const where = {
    dealershipId,
    customerId,
    deletedAt: null,
    ...(filters.completed === true && { completedAt: { not: null } }),
    ...(filters.completed === false && { completedAt: null }),
  };
  const [data, total] = await Promise.all([
    prisma.customerTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        createdByProfile: { select: { id: true, fullName: true, email: true } },
        completedByProfile: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.customerTask.count({ where }),
  ]);
  return { data, total };
}

export async function getTaskById(
  dealershipId: string,
  customerId: string,
  taskId: string
) {
  return prisma.customerTask.findFirst({
    where: { id: taskId, dealershipId, customerId, deletedAt: null },
    include: {
      createdByProfile: { select: { id: true, fullName: true, email: true } },
      completedByProfile: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function createTask(
  dealershipId: string,
  customerId: string,
  data: { title: string; description?: string | null; dueAt?: Date | null },
  createdBy: string
) {
  return prisma.customerTask.create({
    data: {
      dealershipId,
      customerId,
      title: data.title,
      description: data.description ?? null,
      dueAt: data.dueAt ?? null,
      createdBy,
    },
    include: {
      createdByProfile: { select: { id: true, fullName: true, email: true } },
      completedByProfile: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function updateTask(
  dealershipId: string,
  customerId: string,
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    dueAt?: Date | null;
    completedAt?: Date | null;
    completedBy?: string | null;
  }
) {
  const existing = await prisma.customerTask.findFirst({
    where: { id: taskId, dealershipId, customerId, deletedAt: null },
  });
  if (!existing) return null;
  const updatePayload: Record<string, unknown> = {};
  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.description !== undefined) updatePayload.description = data.description ?? null;
  if (data.dueAt !== undefined) updatePayload.dueAt = data.dueAt ?? null;
  if (data.completedAt !== undefined) updatePayload.completedAt = data.completedAt ?? null;
  if (data.completedBy !== undefined) updatePayload.completedBy = data.completedBy ?? null;
  if (Object.keys(updatePayload).length === 0) return getTaskById(dealershipId, customerId, taskId);
  await prisma.customerTask.update({
    where: { id: taskId },
    data: updatePayload,
  });
  const updated = await getTaskById(dealershipId, customerId, taskId);
  if (updated) {
    await upsertCustomerLastActivitySummary(
      dealershipId,
      customerId,
      updated.updatedAt
    );
  }
  return updated;
}

export async function completeTask(
  dealershipId: string,
  customerId: string,
  taskId: string,
  completedBy: string
) {
  const existing = await prisma.customerTask.findFirst({
    where: { id: taskId, dealershipId, customerId, deletedAt: null },
  });
  if (!existing) return null;
  if (existing.completedAt) return getTaskById(dealershipId, customerId, taskId);
  await prisma.customerTask.update({
    where: { id: taskId },
    data: { completedAt: new Date(), completedBy },
  });
  const updated = await getTaskById(dealershipId, customerId, taskId);
  if (updated) {
    await upsertCustomerLastActivitySummary(
      dealershipId,
      customerId,
      updated.updatedAt
    );
  }
  return updated;
}

export async function softDeleteTask(
  dealershipId: string,
  customerId: string,
  taskId: string,
  deletedBy: string
) {
  const existing = await prisma.customerTask.findFirst({
    where: { id: taskId, dealershipId, customerId, deletedAt: null },
  });
  if (!existing) return null;
  await prisma.customerTask.update({
    where: { id: taskId },
    data: { deletedAt: new Date(), deletedBy },
  });
  return existing;
}

/** Dashboard: tasks for current user (created by) in this dealership, not completed, not deleted. */
export async function listMyTasks(
  dealershipId: string,
  userId: string,
  limit: number
): Promise<
  { id: string; title: string; dueAt: Date | null; customerId: string; customerName: string }[]
> {
  const rows = await prisma.customerTask.findMany({
    where: {
      dealershipId,
      createdBy: userId,
      completedAt: null,
      deletedAt: null,
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      dueAt: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueAt: r.dueAt,
    customerId: r.customerId,
    customerName: r.customer.name,
  }));
}

export async function listDueTasksForCommandCenter(
  dealershipId: string,
  options: {
    limit: number;
    dueBefore: Date;
    createdBy?: string;
  }
): Promise<
  { id: string; title: string; dueAt: Date | null; customerId: string; customerName: string }[]
> {
  labelQueryFamily("crm.command-center.due-tasks");
  const rows = await prisma.customerTask.findMany({
    where: {
      dealershipId,
      deletedAt: null,
      completedAt: null,
      dueAt: { lte: options.dueBefore },
      ...(options.createdBy ? { createdBy: options.createdBy } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: options.limit,
    select: {
      id: true,
      title: true,
      dueAt: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    dueAt: row.dueAt,
    customerId: row.customerId,
    customerName: row.customer.name,
  }));
}
