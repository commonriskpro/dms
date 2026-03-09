/** @jest-environment node */
/**
 * Activity: create note or task → CustomerActivity row appended.
 */
import { prisma } from "@/lib/db";
import * as customerService from "../service/customer";
import * as noteService from "../service/note";
import * as taskService from "../service/task";
import * as activityService from "../service/activity";


const dealerId = "71000000-0000-0000-0000-000000000001";
const userId = "72000000-0000-0000-0000-000000000002";

async function ensureTestData(): Promise<{ customerId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Activity Customers Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "activity-cust@test.local" },
    update: {},
  });
  const customer = await customerService.createCustomer(
    dealerId,
    userId,
    { name: "Activity Customer", status: "LEAD" },
    { ip: "127.0.0.1" }
  );
  return { customerId: customer.id };
}

describe("Customers activity", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("createNote appends CustomerActivity row (note_added)", async () => {
    const { customerId } = await ensureTestData();
    const beforeCount = await prisma.customerActivity.count({
      where: { dealershipId: dealerId, customerId },
    });
    const note = await noteService.createNote(
      dealerId,
      userId,
      customerId,
      { body: "Activity note" },
      { ip: "127.0.0.1" }
    );
    const after = await prisma.customerActivity.findFirst({
      where: {
        dealershipId: dealerId,
        customerId,
        activityType: "note_added",
        entityType: "Note",
        entityId: note.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(after).toBeDefined();
    expect(after?.actorId).toBe(userId);
    const totalAfter = await prisma.customerActivity.count({
      where: { dealershipId: dealerId, customerId },
    });
    expect(totalAfter).toBe(beforeCount + 1);
  });

  it("createTask appends CustomerActivity row (task_created)", async () => {
    const { customerId } = await ensureTestData();
    const beforeCount = await prisma.customerActivity.count({
      where: { dealershipId: dealerId, customerId },
    });
    const task = await taskService.createTask(
      dealerId,
      userId,
      customerId,
      { title: "Activity task" },
      { ip: "127.0.0.1" }
    );
    const after = await prisma.customerActivity.findFirst({
      where: {
        dealershipId: dealerId,
        customerId,
        activityType: "task_created",
        entityType: "Customer",
        entityId: customerId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(after).toBeDefined();
    expect(after?.actorId).toBe(userId);
    expect((after?.metadata as { taskId?: string })?.taskId).toBe(task.id);
    const totalAfter = await prisma.customerActivity.count({
      where: { dealershipId: dealerId, customerId },
    });
    expect(totalAfter).toBe(beforeCount + 1);
  });

  it("completeTask appends CustomerActivity row (task_completed)", async () => {
    const { customerId } = await ensureTestData();
    const task = await taskService.createTask(
      dealerId,
      userId,
      customerId,
      { title: "Task to complete for activity" },
      { ip: "127.0.0.1" }
    );
    const beforeCount = await prisma.customerActivity.count({
      where: { dealershipId: dealerId, customerId },
    });
    await taskService.completeTask(dealerId, userId, customerId, task.id, {
      ip: "127.0.0.1",
    });
    const after = await prisma.customerActivity.findFirst({
      where: {
        dealershipId: dealerId,
        customerId,
        activityType: "task_completed",
        entityType: "Task",
        entityId: task.id,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(after).toBeDefined();
    expect(after?.actorId).toBe(userId);
    expect(after?.dealershipId).toBe(dealerId);
    expect(after?.customerId).toBe(customerId);
    expect(after?.createdAt).toBeDefined();
    const totalAfter = await prisma.customerActivity.count({
      where: { dealershipId: dealerId, customerId },
    });
    expect(totalAfter).toBe(beforeCount + 1);
  });

  it("listActivity returns activity for customer", async () => {
    const { customerId } = await ensureTestData();
    const { data, total } = await activityService.listActivity(dealerId, customerId, {
      limit: 10,
      offset: 0,
    });
    expect(Array.isArray(data)).toBe(true);
    expect(typeof total).toBe("number");
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it("logSmsSent stores activity with no PII in metadata", async () => {
    const { customerId } = await ensureTestData();
    await activityService.logSmsSent(dealerId, userId, customerId);
    const row = await prisma.customerActivity.findFirst({
      where: {
        dealershipId: dealerId,
        customerId,
        activityType: "sms_sent",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(row).toBeDefined();
    const meta = (row?.metadata ?? {}) as Record<string, unknown>;
    expect(meta.email).toBeUndefined();
    expect(meta.phone).toBeUndefined();
    expect(meta.messageBody).toBeUndefined();
    expect(meta.message).toBeUndefined();
  });

  it("logAppointmentScheduled stores activity with no PII in metadata", async () => {
    const { customerId } = await ensureTestData();
    await activityService.logAppointmentScheduled(dealerId, userId, customerId, {
      scheduledAt: "2025-06-01T14:00:00.000Z",
      notes: "Short note",
    });
    const row = await prisma.customerActivity.findFirst({
      where: {
        dealershipId: dealerId,
        customerId,
        activityType: "appointment_scheduled",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(row).toBeDefined();
    const meta = (row?.metadata ?? {}) as Record<string, unknown>;
    expect(meta.email).toBeUndefined();
    expect(meta.phone).toBeUndefined();
    expect(meta.messageBody).toBeUndefined();
    expect(meta.message).toBeUndefined();
    expect(meta.scheduledAt).toBe("2025-06-01T14:00:00.000Z");
  });
});
