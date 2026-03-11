import * as customersDb from "../db/customers";
import * as tasksDb from "../db/tasks";
import * as activityDb from "../db/activity";
import { auditLog } from "@/lib/audit";
import { emitEvent } from "@/lib/infrastructure/events/eventBus";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

export type TaskListOptions = { limit: number; offset: number; completed?: boolean };

export async function listTasks(
  dealershipId: string,
  customerId: string,
  options: TaskListOptions
) {
  await requireTenantActiveForRead(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  return tasksDb.listTasks(dealershipId, customerId, {
    limit: options.limit,
    offset: options.offset,
    filters: { completed: options.completed },
  });
}

export async function createTask(
  dealershipId: string,
  userId: string,
  customerId: string,
  data: { title: string; description?: string | null; dueAt?: Date | null },
  meta?: { ip?: string; userAgent?: string }
) {
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const created = await tasksDb.createTask(dealershipId, customerId, data, userId);
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.task.created",
    entity: "CustomerTask",
    entityId: created.id,
    metadata: { customerId, taskId: created.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await activityDb.appendActivity(
    dealershipId,
    customerId,
    "task_created",
    "Customer",
    customerId,
    { taskId: created.id },
    userId
  );
  return created;
}

export async function updateTask(
  dealershipId: string,
  userId: string,
  customerId: string,
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    dueAt?: Date | null;
    completedAt?: Date | null;
    completedBy?: string | null;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const existing = await tasksDb.getTaskById(dealershipId, customerId, taskId);
  if (!existing) throw new ApiError("NOT_FOUND", "Task not found");

  const wasCompleted = !!existing.completedAt;
  const completing = data.completedAt !== undefined && data.completedAt !== null && !wasCompleted;
  const completedBy = completing ? userId : data.completedBy ?? existing.completedBy;

  const updated = await tasksDb.updateTask(dealershipId, customerId, taskId, {
    ...data,
    ...(completing && { completedBy }),
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Task not found");

  if (completing) {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "customer.task.completed",
      entity: "CustomerTask",
      entityId: taskId,
      metadata: { customerId, taskId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    await activityDb.appendActivity(
      dealershipId,
      customerId,
      "task_completed",
      "Task",
      taskId,
      null,
      userId
    );
    emitEvent("customer.task_completed", {
      customerId,
      taskId,
      dealershipId,
      completedBy: userId,
    });
  } else {
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "customer.task.updated",
      entity: "CustomerTask",
      entityId: taskId,
      metadata: { customerId, taskId },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }
  return updated;
}

export async function completeTask(
  dealershipId: string,
  userId: string,
  customerId: string,
  taskId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const updated = await tasksDb.completeTask(dealershipId, customerId, taskId, userId);
  if (!updated) throw new ApiError("NOT_FOUND", "Task not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.task.completed",
    entity: "CustomerTask",
    entityId: taskId,
    metadata: { customerId, taskId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  await activityDb.appendActivity(
    dealershipId,
    customerId,
    "task_completed",
    "Task",
    taskId,
    null,
    userId
  );
  emitEvent("customer.task_completed", {
    customerId,
    taskId,
    dealershipId,
    completedBy: userId,
  });
  return updated;
}

export async function deleteTask(
  dealershipId: string,
  userId: string,
  customerId: string,
  taskId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const customer = await customersDb.getCustomerById(dealershipId, customerId);
  if (!customer) throw new ApiError("NOT_FOUND", "Customer not found");
  const existing = await tasksDb.softDeleteTask(dealershipId, customerId, taskId, userId);
  if (!existing) throw new ApiError("NOT_FOUND", "Task not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "customer.task.deleted",
    entity: "CustomerTask",
    entityId: taskId,
    metadata: { customerId, taskId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return existing;
}
