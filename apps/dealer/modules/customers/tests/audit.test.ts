/** @jest-environment node */
/**
 * Audit: create customer → customer.created; create note → customer.note.created;
 * complete task → customer.task.completed.
 */
import { prisma } from "@/lib/db";
import * as customerService from "../service/customer";
import * as noteService from "../service/note";
import * as taskService from "../service/task";
import * as activityService from "../service/activity";
import * as callbacksService from "../service/callbacks";
import * as lastVisitService from "../service/last-visit";


const dealerId = "f1000000-0000-0000-0000-000000000001";
const userId = "f2000000-0000-0000-0000-000000000002";

async function ensureTestData(): Promise<{ customerId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Audit Customers Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "audit-cust@test.local" },
    update: {},
  });
  let customer = await prisma.customer.findFirst({
    where: { dealershipId: dealerId, name: "Audit Customer", deletedAt: null },
  });
  if (!customer) {
    customer = await customerService.createCustomer(
      dealerId,
      userId,
      { name: "Audit Customer", status: "LEAD" },
      { ip: "127.0.0.1" }
    );
  }
  return { customerId: customer.id };
}

describe("Customers audit", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("createCustomer creates customer.created audit log row", async () => {
    const created = await customerService.createCustomer(
      dealerId,
      userId,
      { name: "Audit New Customer", status: "ACTIVE" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Customer",
        action: "customer.created",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(created.id);
    expect(meta?.status).toBe("ACTIVE");
  });

  it("createNote creates customer.note.created audit log row", async () => {
    const { customerId } = await ensureTestData();
    const created = await noteService.createNote(
      dealerId,
      userId,
      customerId,
      { body: "Test note for audit" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerNote",
        action: "customer.note.created",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.noteId).toBe(created.id);
  });

  it("completeTask creates customer.task.completed audit log row", async () => {
    const { customerId } = await ensureTestData();
    const task = await taskService.createTask(
      dealerId,
      userId,
      customerId,
      { title: "Audit task" },
      { ip: "127.0.0.1" }
    );
    await taskService.completeTask(dealerId, userId, customerId, task.id, {
      ip: "127.0.0.1",
    });
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerTask",
        action: "customer.task.completed",
        entityId: task.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.taskId).toBe(task.id);
  });

  it("deleteCustomer creates customer.deleted audit log row", async () => {
    const created = await customerService.createCustomer(
      dealerId,
      userId,
      { name: "Audit Delete Me", status: "LEAD" },
      { ip: "127.0.0.1" }
    );
    await customerService.deleteCustomer(dealerId, userId, created.id, {
      ip: "127.0.0.1",
    });
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Customer",
        action: "customer.deleted",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
  });

  it("updateCustomer creates customer.updated audit log row", async () => {
    const { customerId } = await ensureTestData();
    await customerService.updateCustomer(
      dealerId,
      userId,
      customerId,
      { name: "Audit Customer Updated", status: "ACTIVE" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Customer",
        action: "customer.updated",
        entityId: customerId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(Array.isArray(meta?.changedFields)).toBe(true);
  });

  it("softDeleteNote creates customer.note.deleted audit log row", async () => {
    const { customerId } = await ensureTestData();
    const created = await noteService.createNote(
      dealerId,
      userId,
      customerId,
      { body: "Note to delete for audit" },
      { ip: "127.0.0.1" }
    );
    await noteService.softDeleteNote(dealerId, userId, customerId, created.id, {
      ip: "127.0.0.1",
    });
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerNote",
        action: "customer.note.deleted",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.noteId).toBe(created.id);
  });

  it("createTask creates customer.task.created audit log row", async () => {
    const { customerId } = await ensureTestData();
    const created = await taskService.createTask(
      dealerId,
      userId,
      customerId,
      { title: "Audit task created" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerTask",
        action: "customer.task.created",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.taskId).toBe(created.id);
  });

  it("deleteTask creates customer.task.deleted audit log row", async () => {
    const { customerId } = await ensureTestData();
    const task = await taskService.createTask(
      dealerId,
      userId,
      customerId,
      { title: "Task to delete for audit" },
      { ip: "127.0.0.1" }
    );
    await taskService.deleteTask(dealerId, userId, customerId, task.id, {
      ip: "127.0.0.1",
    });
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerTask",
        action: "customer.task.deleted",
        entityId: task.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.taskId).toBe(task.id);
  });

  it("logCall creates customer_call.logged audit log row", async () => {
    const { customerId } = await ensureTestData();
    const created = await activityService.logCall(dealerId, userId, customerId, {
      summary: "Audit call",
    });
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerActivity",
        action: "customer_call.logged",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.activityId).toBe(created.id);
  });

  it("createCallback creates customer_callback.scheduled audit log row", async () => {
    const { customerId } = await ensureTestData();
    const created = await callbacksService.createCallback(
      dealerId,
      userId,
      customerId,
      { callbackAt: new Date(Date.now() + 86400000), reason: "Audit callback" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerCallback",
        action: "customer_callback.scheduled",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.callbackId).toBe(created.id);
  });

  it("updateCallback status DONE creates customer_callback.completed audit log row", async () => {
    const { customerId } = await ensureTestData();
    const created = await callbacksService.createCallback(
      dealerId,
      userId,
      customerId,
      { callbackAt: new Date(Date.now() + 86400000) },
      { ip: "127.0.0.1" }
    );
    await callbacksService.updateCallback(
      dealerId,
      userId,
      customerId,
      created.id,
      { status: "DONE" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerCallback",
        action: "customer_callback.completed",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.callbackId).toBe(created.id);
  });

  it("updateCallback snoozedUntil creates customer_callback.snoozed audit log row", async () => {
    const { customerId } = await ensureTestData();
    const created = await callbacksService.createCallback(
      dealerId,
      userId,
      customerId,
      { callbackAt: new Date(Date.now() + 86400000) },
      { ip: "127.0.0.1" }
    );
    const snoozedUntil = new Date(Date.now() + 2 * 86400000);
    await callbacksService.updateCallback(
      dealerId,
      userId,
      customerId,
      created.id,
      { snoozedUntil },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerCallback",
        action: "customer_callback.snoozed",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.callbackId).toBe(created.id);
  });

  it("updateCallback status CANCELLED creates customer_callback.cancelled audit log row", async () => {
    const { customerId } = await ensureTestData();
    const created = await callbacksService.createCallback(
      dealerId,
      userId,
      customerId,
      { callbackAt: new Date(Date.now() + 86400000) },
      { ip: "127.0.0.1" }
    );
    await callbacksService.updateCallback(
      dealerId,
      userId,
      customerId,
      created.id,
      { status: "CANCELLED" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "CustomerCallback",
        action: "customer_callback.cancelled",
        entityId: created.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
    expect(meta?.callbackId).toBe(created.id);
  });

  it("updateLastVisit creates customer.last_visit.updated audit log row", async () => {
    const { customerId } = await ensureTestData();
    await lastVisitService.updateLastVisit(dealerId, userId, customerId, {
      ip: "127.0.0.1",
    });
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerId,
        entity: "Customer",
        action: "customer.last_visit.updated",
        entityId: customerId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userId);
    const meta = log?.metadata as Record<string, unknown> | null;
    expect(meta?.customerId).toBe(customerId);
  });
});
