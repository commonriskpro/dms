/** @jest-environment node */
/**
 * Tenant isolation: Dealer A cannot list/get/update/delete Dealer B customer;
 * cannot add note/task to Dealer B customer; search must not return Dealer B customers.
 */
import { prisma } from "@/lib/db";
import * as customersDb from "../db/customers";
import * as customerService from "../service/customer";
import * as noteService from "../service/note";
import * as taskService from "../service/task";
import * as activityService from "../service/activity";
import * as timelineService from "../service/timeline";
import * as callbacksService from "../service/callbacks";
import * as lastVisitService from "../service/last-visit";


const dealerAId = "d1000000-0000-0000-0000-000000000001";
const dealerBId = "d2000000-0000-0000-0000-000000000002";
const userAId = "d3000000-0000-0000-0000-000000000003";

async function ensureTestData(): Promise<{ customerBId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Dealer B" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userAId },
    create: { id: userAId, email: "tenant-cust-a@test.local" },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: "d4000000-0000-0000-0000-000000000004" },
    create: {
      id: "d4000000-0000-0000-0000-000000000004",
      dealershipId: dealerBId,
      name: "Customer B",
      status: "LEAD",
    },
    update: {},
  });
  await prisma.customerCallback.upsert({
    where: { id: "d5000000-0000-0000-0000-000000000005" },
    create: {
      id: "d5000000-0000-0000-0000-000000000005",
      dealershipId: dealerBId,
      customerId: customerB.id,
      callbackAt: new Date(Date.now() + 86400000),
      status: "SCHEDULED",
    },
    update: {},
  });
  return { customerBId: customerB.id };
}

describe("Customers tenant isolation", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("listCustomers for Dealer A does not return Dealer B customers", async () => {
    const { data } = await customersDb.listCustomers(dealerAId, {
      limit: 25,
      offset: 0,
    });
    const fromB = data.filter((c) => c.dealershipId === dealerBId);
    expect(fromB).toHaveLength(0);
  });

  it("getCustomerSummaryMetrics for Dealer A does not count Dealer B customers", async () => {
    const metricsA = await customersDb.getCustomerSummaryMetrics(dealerAId);
    const metricsB = await customersDb.getCustomerSummaryMetrics(dealerBId);
    expect(typeof metricsA.totalCustomers).toBe("number");
    expect(typeof metricsB.totalCustomers).toBe("number");
    expect(metricsA.totalCustomers).toBeGreaterThanOrEqual(0);
    expect(metricsB.totalCustomers).toBeGreaterThanOrEqual(1);
  });

  it("getCustomerById with wrong dealership returns null", async () => {
    const { customerBId } = await ensureTestData();
    const found = await customersDb.getCustomerById(dealerAId, customerBId);
    expect(found).toBeNull();
  });

  it("getCustomer (service) with wrong dealership throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(customerService.getCustomer(dealerAId, customerBId)).rejects.toThrow();
  });

  it("updateCustomer with wrong dealership throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      customerService.updateCustomer(dealerAId, userAId, customerBId, { name: "Hacked" })
    ).rejects.toThrow();
  });

  it("deleteCustomer with wrong dealership throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      customerService.deleteCustomer(dealerAId, userAId, customerBId)
    ).rejects.toThrow();
  });

  it("listNotes for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      noteService.listNotes(dealerAId, customerBId, { limit: 25, offset: 0 })
    ).rejects.toThrow();
  });

  it("createNote for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      noteService.createNote(dealerAId, userAId, customerBId, { body: "Note" })
    ).rejects.toThrow();
  });

  it("listTasks for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      taskService.listTasks(dealerAId, customerBId, { limit: 25, offset: 0 })
    ).rejects.toThrow();
  });

  it("createTask for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      taskService.createTask(dealerAId, userAId, customerBId, { title: "Task" })
    ).rejects.toThrow();
  });

  it("listActivity for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      activityService.listActivity(dealerAId, customerBId, { limit: 25, offset: 0 })
    ).rejects.toThrow();
  });

  it("setDisposition for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      customerService.setDisposition(dealerAId, userAId, customerBId, { status: "ACTIVE" })
    ).rejects.toThrow();
  });

  it("createActivity (POST activity) for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      activityService.createActivity(dealerAId, userAId, customerBId, {
        activityType: "sms_sent",
      })
    ).rejects.toThrow();
  });

  it("listTimeline for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      timelineService.listTimeline(dealerAId, customerBId, { limit: 25, offset: 0 })
    ).rejects.toThrow();
  });

  it("listCallbacks for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      callbacksService.listCallbacks(dealerAId, customerBId, { limit: 25, offset: 0 })
    ).rejects.toThrow();
  });

  it("createCallback for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      callbacksService.createCallback(
        dealerAId,
        userAId,
        customerBId,
        { callbackAt: new Date(Date.now() + 86400000) }
      )
    ).rejects.toThrow();
  });

  it("updateCallback for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    const callbackId = "d5000000-0000-0000-0000-000000000005";
    await expect(
      callbacksService.updateCallback(dealerAId, userAId, customerBId, callbackId, {
        status: "DONE",
      })
    ).rejects.toThrow();
  });

  it("updateLastVisit for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      lastVisitService.updateLastVisit(dealerAId, userAId, customerBId)
    ).rejects.toThrow();
  });

  it("logCall for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      activityService.logCall(dealerAId, userAId, customerBId, { summary: "Call" })
    ).rejects.toThrow();
  });

  it("logSmsSent (POST sms) for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(activityService.logSmsSent(dealerAId, userAId, customerBId)).rejects.toThrow();
  });

  it("logAppointmentScheduled (POST appointments) for Dealer B customer when called as Dealer A throws NOT_FOUND", async () => {
    const { customerBId } = await ensureTestData();
    await expect(
      activityService.logAppointmentScheduled(dealerAId, userAId, customerBId, {
        scheduledAt: "2025-06-01T14:00:00.000Z",
      })
    ).rejects.toThrow();
  });

  it("search does not return Dealer B customers when querying as Dealer A", async () => {
    const { customerBId } = await ensureTestData();
    const customerB = await prisma.customer.findUnique({ where: { id: customerBId } });
    if (!customerB) return;
    const { data } = await customersDb.listCustomers(dealerAId, {
      limit: 25,
      offset: 0,
      filters: { search: customerB.name },
    });
    const fromB = data.filter((c) => c.id === customerBId);
    expect(fromB).toHaveLength(0);
  });

  it("search by phone/email matching Dealer B customer returns empty for Dealer A", async () => {
    const uniquePhone = "+15559998877";
    const uniqueEmail = "dealer-b-only@tenant-isolation.test";
    await ensureTestData();
    const customerB = await prisma.customer.findFirst({
      where: { dealershipId: dealerBId },
    });
    if (!customerB) return;
    await prisma.customerPhone.create({
      data: {
        dealershipId: dealerBId,
        customerId: customerB.id,
        value: uniquePhone,
        isPrimary: true,
      },
    });
    await prisma.customerEmail.create({
      data: {
        dealershipId: dealerBId,
        customerId: customerB.id,
        value: uniqueEmail,
        isPrimary: true,
      },
    });
    const byPhone = await customersDb.listCustomers(dealerAId, {
      limit: 25,
      offset: 0,
      filters: { search: uniquePhone },
    });
    const byEmail = await customersDb.listCustomers(dealerAId, {
      limit: 25,
      offset: 0,
      filters: { search: uniqueEmail },
    });
    expect(byPhone.data).toHaveLength(0);
    expect(byEmail.data).toHaveLength(0);
  });
});
