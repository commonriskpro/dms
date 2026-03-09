/** @jest-environment node */
/**
 * RBAC: user without inventory.read gets 403 on read operations;
 * user without inventory.write gets 403 on write operations.
 */
import { prisma } from "@/lib/db";
import { loadUserPermissions, requirePermission } from "@/lib/rbac";
import { ApiError } from "@/lib/auth";

const dealerId = "b1000000-0000-0000-0000-000000000001";
const readOnlyUserId = "b2000000-0000-0000-0000-000000000002";
const noInventoryUserId = "b3000000-0000-0000-0000-000000000003";

async function ensureTestData() {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "RBAC Inventory Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: readOnlyUserId },
    create: { id: readOnlyUserId, email: "readonly@test.local" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: noInventoryUserId },
    create: { id: noInventoryUserId, email: "noinv@test.local" },
    update: {},
  });
  const permRead = await prisma.permission.findFirst({ where: { key: "inventory.read" } });
  const permWrite = await prisma.permission.findFirst({ where: { key: "inventory.write" } });
  const permAdmin = await prisma.permission.findFirst({ where: { key: "admin.dealership.read" } });
  if (!permRead || !permAdmin) return;
  const roleReadOnly = await prisma.role.upsert({
    where: { id: "b4000000-0000-0000-0000-000000000004" },
    create: {
      id: "b4000000-0000-0000-0000-000000000004",
      dealershipId: dealerId,
      name: "InventoryReadOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permRead.id }] },
    },
    update: {},
  });
  const roleNoInventory = await prisma.role.upsert({
    where: { id: "b5000000-0000-0000-0000-000000000005" },
    create: {
      id: "b5000000-0000-0000-0000-000000000005",
      dealershipId: dealerId,
      name: "NoInventory",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permAdmin.id }] },
    },
    update: {},
  });
  await prisma.membership.upsert({
    where: { id: "b6000000-0000-0000-0000-000000000006" },
    create: {
      id: "b6000000-0000-0000-0000-000000000006",
      dealershipId: dealerId,
      userId: readOnlyUserId,
      roleId: roleReadOnly.id,
    },
    update: { roleId: roleReadOnly.id },
  });
  await prisma.membership.upsert({
    where: { id: "b7000000-0000-0000-0000-000000000007" },
    create: {
      id: "b7000000-0000-0000-0000-000000000007",
      dealershipId: dealerId,
      userId: noInventoryUserId,
      roleId: roleNoInventory.id,
    },
    update: { roleId: roleNoInventory.id },
  });
}

describe("Inventory RBAC", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("no inventory.read → FORBIDDEN (403) on read operations", async () => {
    const perms = await loadUserPermissions(noInventoryUserId, dealerId);
    expect(perms).not.toContain("inventory.read");
    await expect(
      requirePermission(noInventoryUserId, dealerId, "inventory.read")
    ).rejects.toThrow(ApiError);
    try {
      await requirePermission(noInventoryUserId, dealerId, "inventory.read");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("no inventory.write → FORBIDDEN (403) on write operations (POST/PATCH/DELETE)", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerId);
    expect(perms).toContain("inventory.read");
    expect(perms).not.toContain("inventory.write");
    await expect(
      requirePermission(readOnlyUserId, dealerId, "inventory.write")
    ).rejects.toThrow(ApiError);
    try {
      await requirePermission(readOnlyUserId, dealerId, "inventory.write");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("user without documents.read cannot pass requirePermission(documents.read) for photo list", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerId);
    if (perms.includes("documents.read")) return;
    await expect(
      requirePermission(readOnlyUserId, dealerId, "documents.read")
    ).rejects.toThrow(ApiError);
  });

  it("user without documents.write cannot pass requirePermission(documents.write) for photo upload", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerId);
    if (perms.includes("documents.write")) return;
    await expect(
      requirePermission(readOnlyUserId, dealerId, "documents.write")
    ).rejects.toThrow(ApiError);
  });
});
