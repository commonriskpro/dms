/** @jest-environment node */
/**
 * Soft delete: soft-deleted customers excluded from list, search, GET by id;
 * soft-deleted notes/tasks excluded from lists.
 */
import { prisma } from "@/lib/db";
import * as customersDb from "../db/customers";
import * as notesDb from "../db/notes";
import * as tasksDb from "../db/tasks";
import * as customerService from "../service/customer";
import * as noteService from "../service/note";
import * as taskService from "../service/task";


const dealerId = "71000000-0000-0000-0000-000000000001";
const userId = "72000000-0000-0000-0000-000000000002";

async function ensureTestData(uniqueName?: string): Promise<{ customerId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Soft Delete Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "softdelete@test.local" },
    update: {},
  });
  const name = uniqueName ?? `Soft Delete Customer ${Date.now()}`;
  const customer = await customerService.createCustomer(
    dealerId,
    userId,
    { name, status: "LEAD" },
    { ip: "127.0.0.1" }
  );
  return { customerId: customer.id };
}

describe("Customers soft delete", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("soft-deleted customer is excluded from list", async () => {
    const { customerId } = await ensureTestData();
    const { data: beforeList } = await customersDb.listCustomers(dealerId, {
      limit: 100,
      offset: 0,
    });
    const foundBefore = beforeList.some((c) => c.id === customerId);
    expect(foundBefore).toBe(true);

    await customerService.deleteCustomer(dealerId, userId, customerId, {
      ip: "127.0.0.1",
    });

    const { data: afterList } = await customersDb.listCustomers(dealerId, {
      limit: 100,
      offset: 0,
    });
    const foundAfter = afterList.some((c) => c.id === customerId);
    expect(foundAfter).toBe(false);
  });

  it("soft-deleted customer is excluded from search", async () => {
    const searchTerm = `SoftDeleteSearch ${Date.now()}`;
    const { customerId } = await ensureTestData(searchTerm);
    await customerService.deleteCustomer(dealerId, userId, customerId, {
      ip: "127.0.0.1",
    });
    const { data } = await customersDb.listCustomers(dealerId, {
      limit: 100,
      offset: 0,
      filters: { search: searchTerm },
    });
    const found = data.some((c) => c.id === customerId);
    expect(found).toBe(false);
  });

  it("GET customer by id returns NOT_FOUND for soft-deleted customer", async () => {
    const { customerId } = await ensureTestData();
    await customerService.deleteCustomer(dealerId, userId, customerId, {
      ip: "127.0.0.1",
    });
    await expect(customerService.getCustomer(dealerId, customerId)).rejects.toThrow();
  });

  it("listNotes excludes soft-deleted notes", async () => {
    const { customerId } = await ensureTestData();
    const note = await noteService.createNote(
      dealerId,
      userId,
      customerId,
      { body: "Note to soft delete" },
      { ip: "127.0.0.1" }
    );
    const { data: beforeList } = await notesDb.listNotes(dealerId, customerId, {
      limit: 25,
      offset: 0,
    });
    expect(beforeList.some((n) => n.id === note.id)).toBe(true);

    await noteService.softDeleteNote(dealerId, userId, customerId, note.id, {
      ip: "127.0.0.1",
    });

    const { data: afterList } = await notesDb.listNotes(dealerId, customerId, {
      limit: 25,
      offset: 0,
    });
    expect(afterList.some((n) => n.id === note.id)).toBe(false);
  });

  it("listTasks excludes soft-deleted tasks", async () => {
    const { customerId } = await ensureTestData();
    const task = await taskService.createTask(
      dealerId,
      userId,
      customerId,
      { title: "Task to soft delete" },
      { ip: "127.0.0.1" }
    );
    const { data: beforeList } = await tasksDb.listTasks(dealerId, customerId, {
      limit: 25,
      offset: 0,
    });
    expect(beforeList.some((t) => t.id === task.id)).toBe(true);

    await taskService.deleteTask(dealerId, userId, customerId, task.id, {
      ip: "127.0.0.1",
    });

    const { data: afterList } = await tasksDb.listTasks(dealerId, customerId, {
      limit: 25,
      offset: 0,
    });
    expect(afterList.some((t) => t.id === task.id)).toBe(false);
  });
});
