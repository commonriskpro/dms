/**
 * RBAC: user without deals.read gets 403 on read; user without deals.write gets 403 on write.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { loadUserPermissions, requirePermission } from "@/lib/rbac";
import { ApiError } from "@/lib/auth";

const hasDb =
  process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL;

const dealerId = "51000000-0000-0000-0000-000000000001";
const readOnlyUserId = "52000000-0000-0000-0000-000000000002";
const noDealsUserId = "53000000-0000-0000-0000-000000000003";

async function ensureTestData() {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "RBAC Deals Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: readOnlyUserId },
    create: { id: readOnlyUserId, email: "deals-readonly@test.local" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: noDealsUserId },
    create: { id: noDealsUserId, email: "nodeals@test.local" },
    update: {},
  });
  const permRead = await prisma.permission.findFirst({ where: { key: "deals.read" } });
  const permWrite = await prisma.permission.findFirst({ where: { key: "deals.write" } });
  const permAdmin = await prisma.permission.findFirst({ where: { key: "admin.dealership.read" } });
  if (!permRead || !permAdmin) return;
  const roleReadOnly = await prisma.role.upsert({
    where: { id: "54000000-0000-0000-0000-000000000004" },
    create: {
      id: "54000000-0000-0000-0000-000000000004",
      dealershipId: dealerId,
      name: "DealsReadOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permRead.id }] },
    },
    update: {},
  });
  const roleNoDeals = await prisma.role.upsert({
    where: { id: "55000000-0000-0000-0000-000000000005" },
    create: {
      id: "55000000-0000-0000-0000-000000000005",
      dealershipId: dealerId,
      name: "NoDeals",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permAdmin.id }] },
    },
    update: {},
  });
  await prisma.membership.upsert({
    where: { id: "56000000-0000-0000-0000-000000000006" },
    create: {
      id: "56000000-0000-0000-0000-000000000006",
      dealershipId: dealerId,
      userId: readOnlyUserId,
      roleId: roleReadOnly.id,
    },
    update: { roleId: roleReadOnly.id },
  });
  await prisma.membership.upsert({
    where: { id: "57000000-0000-0000-0000-000000000007" },
    create: {
      id: "57000000-0000-0000-0000-000000000007",
      dealershipId: dealerId,
      userId: noDealsUserId,
      roleId: roleNoDeals.id,
    },
    update: { roleId: roleNoDeals.id },
  });
}

describe.skipIf(!hasDb)("Deals RBAC", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("user without deals.read cannot pass requirePermission(deals.read)", async () => {
    await expect(
      requirePermission(noDealsUserId, dealerId, "deals.read")
    ).rejects.toThrow(ApiError);
  });

  it("user with deals.read only cannot pass requirePermission(deals.write)", async () => {
    await expect(
      requirePermission(readOnlyUserId, dealerId, "deals.write")
    ).rejects.toThrow(ApiError);
  });

  it("user with deals.read passes requirePermission(deals.read)", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerId);
    expect(perms).toContain("deals.read");
    await requirePermission(readOnlyUserId, dealerId, "deals.read");
  });

  it("user without deals.write cannot pass requirePermission(deals.write)", async () => {
    await expect(
      requirePermission(noDealsUserId, dealerId, "deals.write")
    ).rejects.toThrow(ApiError);
  });
});
