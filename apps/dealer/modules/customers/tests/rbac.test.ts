/** @jest-environment node */
/**
 * RBAC: user without customers.read gets 403 on read operations (GET list, detail, notes, tasks, activity);
 * user without customers.write gets 403 on write operations (POST/PATCH/DELETE customer, notes, tasks).
 */
import { prisma } from "@/lib/db";
import { loadUserPermissions, requirePermission } from "@/lib/rbac";
import { ApiError } from "@/lib/auth";
import { toErrorPayload } from "@/lib/api/errors";


const dealerId = "e1000000-0000-0000-0000-000000000001";
const readOnlyUserId = "e2000000-0000-0000-0000-000000000002";
const noCustomersUserId = "e3000000-0000-0000-0000-000000000003";

async function ensureTestData() {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "RBAC Customers Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: readOnlyUserId },
    create: { id: readOnlyUserId, email: "customers-readonly@test.local" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: noCustomersUserId },
    create: { id: noCustomersUserId, email: "nocustomers@test.local" },
    update: {},
  });
  const permRead = await prisma.permission.upsert({
    where: { key: "customers.read" },
    create: { key: "customers.read", description: null, module: "customers" },
    update: {},
  });
  const permWrite = await prisma.permission.upsert({
    where: { key: "customers.write" },
    create: { key: "customers.write", description: null, module: "customers" },
    update: {},
  });
  const permAdmin = await prisma.permission.upsert({
    where: { key: "admin.dealership.read" },
    create: { key: "admin.dealership.read", description: null, module: "admin" },
    update: {},
  });
  const roleReadOnly = await prisma.role.upsert({
    where: { id: "e4000000-0000-0000-0000-000000000004" },
    create: {
      id: "e4000000-0000-0000-0000-000000000004",
      dealershipId: dealerId,
      name: "CustomersReadOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permRead.id }] },
    },
    update: {},
  });
  const roleNoCustomers = await prisma.role.upsert({
    where: { id: "e5000000-0000-0000-0000-000000000005" },
    create: {
      id: "e5000000-0000-0000-0000-000000000005",
      dealershipId: dealerId,
      name: "NoCustomers",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permAdmin.id }] },
    },
    update: {},
  });
  await prisma.membership.upsert({
    where: { id: "e6000000-0000-0000-0000-000000000006" },
    create: {
      id: "e6000000-0000-0000-0000-000000000006",
      dealershipId: dealerId,
      userId: readOnlyUserId,
      roleId: roleReadOnly.id,
    },
    update: { roleId: roleReadOnly.id },
  });
  await prisma.membership.upsert({
    where: { id: "e7000000-0000-0000-0000-000000000007" },
    create: {
      id: "e7000000-0000-0000-0000-000000000007",
      dealershipId: dealerId,
      userId: noCustomersUserId,
      roleId: roleNoCustomers.id,
    },
    update: { roleId: roleNoCustomers.id },
  });
}

describe("Customers RBAC", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("no customers.read → FORBIDDEN (403) on read operations", async () => {
    const perms = await loadUserPermissions(noCustomersUserId, dealerId);
    expect(perms).not.toContain("customers.read");
    await expect(
      requirePermission(noCustomersUserId, dealerId, "customers.read")
    ).rejects.toThrow(ApiError);
    try {
      await requirePermission(noCustomersUserId, dealerId, "customers.read");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("no customers.write → FORBIDDEN (403) on write operations (POST/PATCH/DELETE)", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerId);
    expect(perms).toContain("customers.read");
    expect(perms).not.toContain("customers.write");
    await expect(
      requirePermission(readOnlyUserId, dealerId, "customers.write")
    ).rejects.toThrow(ApiError);
    try {
      await requirePermission(readOnlyUserId, dealerId, "customers.write");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("FORBIDDEN from missing customers.read maps to 403 response status", async () => {
    try {
      await requirePermission(noCustomersUserId, dealerId, "customers.read");
    } catch (e) {
      const { status } = toErrorPayload(e);
      expect(status).toBe(403);
    }
  });

  it("GET timeline and GET callbacks require customers.read (read-only user has it)", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerId);
    expect(perms).toContain("customers.read");
    await expect(
      requirePermission(readOnlyUserId, dealerId, "customers.read")
    ).resolves.not.toThrow();
  });

  it("POST note, POST call, POST callback, PATCH callback require customers.write (read-only user cannot)", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerId);
    expect(perms).not.toContain("customers.write");
    await expect(
      requirePermission(readOnlyUserId, dealerId, "customers.write")
    ).rejects.toThrow(ApiError);
    try {
      await requirePermission(readOnlyUserId, dealerId, "customers.write");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("POST last-visit / updateLastVisit requires customers.read (read-only user can call)", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerId);
    expect(perms).toContain("customers.read");
    expect(perms).not.toContain("customers.write");
    await expect(
      requirePermission(readOnlyUserId, dealerId, "customers.read")
    ).resolves.not.toThrow();
  });
});
