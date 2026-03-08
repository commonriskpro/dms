/** @jest-environment node */
/**
 * RBAC: user without deals.read gets 403 on read; user without deals.write gets 403 on write.
 * finance.read / finance.write: GET finance/products requires finance.read; PUT/POST/PATCH/DELETE requires finance.write.
 */
import { prisma } from "@/lib/db";
import { loadUserPermissions, requirePermission } from "@/lib/rbac";
import { ApiError } from "@/lib/auth";


const dealerId = "51000000-0000-0000-0000-000000000001";
const readOnlyUserId = "52000000-0000-0000-0000-000000000002";
const noDealsUserId = "53000000-0000-0000-0000-000000000003";
const financeReadOnlyUserId = "58000000-0000-0000-0000-000000000008";

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
  await prisma.profile.upsert({
    where: { id: financeReadOnlyUserId },
    create: { id: financeReadOnlyUserId, email: "finance-readonly@test.local" },
    update: {},
  });
  const permRead = await prisma.permission.findFirst({ where: { key: "deals.read" } });
  const permWrite = await prisma.permission.findFirst({ where: { key: "deals.write" } });
  const permFinanceRead = await prisma.permission.findFirst({ where: { key: "finance.read" } });
  const permFinanceWrite = await prisma.permission.findFirst({ where: { key: "finance.write" } });
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
  if (permFinanceRead) {
    const roleFinanceReadOnly = await prisma.role.upsert({
      where: { id: "59000000-0000-0000-0000-000000000009" },
      create: {
        id: "59000000-0000-0000-0000-000000000009",
        dealershipId: dealerId,
        name: "FinanceReadOnly",
        isSystem: false,
        rolePermissions: { create: [{ permissionId: permFinanceRead.id }] },
      },
      update: {},
    });
    await prisma.membership.upsert({
      where: { id: "5a000000-0000-0000-0000-00000000000a" },
      create: {
        id: "5a000000-0000-0000-0000-00000000000a",
        dealershipId: dealerId,
        userId: financeReadOnlyUserId,
        roleId: roleFinanceReadOnly.id,
      },
      update: { roleId: roleFinanceReadOnly.id },
    });
  }
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

describe("Deals RBAC", () => {
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

  it("user without finance.read cannot pass requirePermission(finance.read)", async () => {
    await expect(
      requirePermission(noDealsUserId, dealerId, "finance.read")
    ).rejects.toThrow(ApiError);
  });

  it("user with finance.read only cannot pass requirePermission(finance.write)", async () => {
    const permFinanceRead = await prisma.permission.findFirst({ where: { key: "finance.read" } });
    if (!permFinanceRead) return;
    await expect(
      requirePermission(financeReadOnlyUserId, dealerId, "finance.write")
    ).rejects.toThrow(ApiError);
  });

  it("user with finance.read passes requirePermission(finance.read)", async () => {
    const permFinanceRead = await prisma.permission.findFirst({ where: { key: "finance.read" } });
    if (!permFinanceRead) return; // skip when seed has no finance.read (document in report)
    const perms = await loadUserPermissions(financeReadOnlyUserId, dealerId);
    expect(perms).toContain("finance.read");
    await requirePermission(financeReadOnlyUserId, dealerId, "finance.read");
  });
});
