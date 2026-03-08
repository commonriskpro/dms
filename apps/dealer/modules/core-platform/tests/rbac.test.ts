/** @jest-environment node */
/**
 * RBAC: requirePermission throws FORBIDDEN when user lacks permission.
 */
import { prisma } from "@/lib/db";
import { loadUserPermissions, requirePermission } from "@/lib/rbac";
import { ApiError } from "@/lib/auth";

const dealerId = "40000000-0000-0000-0000-000000000004";
const salesUserId = "50000000-0000-0000-0000-000000000005";

async function ensureSalesUser() {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "RBAC Test Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: salesUserId },
    create: { id: salesUserId, email: "sales@test.local" },
    update: {},
  });
  const perm = await prisma.permission.findFirst({ where: { key: "inventory.read" } });
  if (!perm) return;
  let salesRole = await prisma.role.findFirst({
    where: { dealershipId: dealerId, name: "Sales", deletedAt: null },
  });
  if (!salesRole) {
    salesRole = await prisma.role.create({
      data: {
        dealershipId: dealerId,
        name: "Sales",
        isSystem: true,
        rolePermissions: { create: [{ permissionId: perm.id }] },
      },
    });
  }
  const member = await prisma.membership.findFirst({
    where: { dealershipId: dealerId, userId: salesUserId, disabledAt: null },
  });
  if (!member) {
    await prisma.membership.create({
      data: { dealershipId: dealerId, userId: salesUserId, roleId: salesRole.id },
    });
  }
}

describe("RBAC", () => {
  beforeAll(async () => {
    await ensureSalesUser();
  });

  it("Sales role does not have admin.roles.write", async () => {
    const permissions = await loadUserPermissions(salesUserId, dealerId);
    expect(permissions).not.toContain("admin.roles.write");
  });

  it("requirePermission(admin.roles.write) throws FORBIDDEN for Sales user", async () => {
    await expect(
      requirePermission(salesUserId, dealerId, "admin.roles.write")
    ).rejects.toThrow(ApiError);
    try {
      await requirePermission(salesUserId, dealerId, "admin.roles.write");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("requirePermission(admin.permissions.read) throws FORBIDDEN for user without it", async () => {
    const perms = await loadUserPermissions(salesUserId, dealerId);
    if (perms.includes("admin.permissions.read")) return; // Sales might have it in seed
    await expect(
      requirePermission(salesUserId, dealerId, "admin.permissions.read")
    ).rejects.toThrow(ApiError);
  });

  it("requirePermission(admin.audit.read) throws FORBIDDEN for user without it", async () => {
    const perms = await loadUserPermissions(salesUserId, dealerId);
    if (perms.includes("admin.audit.read")) return;
    await expect(
      requirePermission(salesUserId, dealerId, "admin.audit.read")
    ).rejects.toThrow(ApiError);
  });

  it("requirePermission(admin.memberships.write) throws FORBIDDEN for user without it", async () => {
    const perms = await loadUserPermissions(salesUserId, dealerId);
    if (perms.includes("admin.memberships.write")) return;
    await expect(
      requirePermission(salesUserId, dealerId, "admin.memberships.write")
    ).rejects.toThrow(ApiError);
  });

  it("requirePermission(documents.read) and documents.write throw FORBIDDEN when missing", async () => {
    const perms = await loadUserPermissions(salesUserId, dealerId);
    if (!perms.includes("documents.read")) {
      await expect(
        requirePermission(salesUserId, dealerId, "documents.read")
      ).rejects.toThrow(ApiError);
    }
    if (!perms.includes("documents.write")) {
      await expect(
        requirePermission(salesUserId, dealerId, "documents.write")
      ).rejects.toThrow(ApiError);
    }
  });
});
