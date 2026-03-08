/** @jest-environment node */
/**
 * DealerCenter RBAC: role union, permission overrides, default deny, tenant isolation.
 */

import { prisma } from "@/lib/db";
import { loadUserPermissions, getDealerAuthContext, requirePermission } from "@/lib/rbac";
import { ApiError } from "@/lib/auth";
import * as userAdminService from "../service/user-admin";

const dealerA = "a0000000-0000-0000-0000-000000000001";
const dealerB = "b0000000-0000-0000-0000-000000000002";
const user1 = "c1000000-0000-0000-0000-000000000001";
const user2 = "c2000000-0000-0000-0000-000000000002";
const actorAdmin = "d0000000-0000-0000-0000-000000000001";

async function ensureFixture() {
  await prisma.dealership.upsert({
    where: { id: dealerA },
    create: { id: dealerA, name: "Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerB },
    create: { id: dealerB, name: "Dealer B" },
    update: {},
  });
  for (const [id, email] of [[user1, "u1@test.local"], [user2, "u2@test.local"], [actorAdmin, "admin@test.local"]] as const) {
    await prisma.profile.upsert({
      where: { id },
      create: { id, email },
      update: {},
    });
  }
  const permRead = await prisma.permission.upsert({
    where: { key: "inventory.read" },
    create: { key: "inventory.read", description: null, module: "inventory" },
    update: {},
  });
  const permWrite = await prisma.permission.upsert({
    where: { key: "inventory.write" },
    create: { key: "inventory.write", description: null, module: "inventory" },
    update: {},
  });
  await prisma.permission.upsert({
    where: { key: "admin.permissions.read" },
    create: { key: "admin.permissions.read", description: null, module: "admin" },
    update: {},
  });
  await prisma.permission.upsert({
    where: { key: "admin.users.read" },
    create: { key: "admin.users.read", description: null, module: "admin" },
    update: {},
  });

  let roleA1 = await prisma.role.findFirst({
    where: { dealershipId: dealerA, name: "RoleA1", deletedAt: null },
  });
  if (!roleA1) {
    roleA1 = await prisma.role.create({
      data: {
        dealershipId: dealerA,
        name: "RoleA1",
        isSystem: false,
        rolePermissions: { create: [{ permissionId: permRead.id }] },
      },
    });
  }
  let roleA2 = await prisma.role.findFirst({
    where: { dealershipId: dealerA, name: "RoleA2", deletedAt: null },
  });
  if (!roleA2) {
    roleA2 = await prisma.role.create({
      data: {
        dealershipId: dealerA,
        name: "RoleA2",
        isSystem: false,
        rolePermissions: { create: [{ permissionId: permWrite.id }] },
      },
    });
  }

  const member1 = await prisma.membership.findFirst({
    where: { dealershipId: dealerA, userId: user1, disabledAt: null },
  });
  if (!member1) {
    await prisma.membership.create({
      data: { dealershipId: dealerA, userId: user1, roleId: roleA1.id },
    });
  }
  await prisma.userRole.deleteMany({ where: { userId: user1 } });
  await prisma.userRole.createMany({
    data: [{ userId: user1, roleId: roleA1.id }, { userId: user1, roleId: roleA2.id }],
  });

  const member2 = await prisma.membership.findFirst({
    where: { dealershipId: dealerB, userId: user2, disabledAt: null },
  });
  if (!member2) {
    const roleB = await prisma.role.findFirst({
      where: { dealershipId: dealerB, deletedAt: null },
    }) ?? await prisma.role.create({
      data: {
        dealershipId: dealerB,
        name: "RoleB",
        isSystem: false,
        rolePermissions: { create: [{ permissionId: permRead.id }] },
      },
    });
    await prisma.membership.create({
      data: { dealershipId: dealerB, userId: user2, roleId: roleB.id },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user2, roleId: roleB.id } },
      create: { userId: user2, roleId: roleB.id },
      update: {},
    });
  }
}

describe("RBAC DealerCenter", () => {
  beforeAll(async () => {
    await ensureFixture();
  });

  it("role union: user with two roles has union of permissions", async () => {
    const perms = await loadUserPermissions(user1, dealerA);
    expect(perms).toContain("inventory.read");
    expect(perms).toContain("inventory.write");
  });

  it("default deny: user without permission gets 403", async () => {
    await expect(
      requirePermission(user1, dealerA, "admin.users.read")
    ).rejects.toThrow(ApiError);
    try {
      await requirePermission(user1, dealerA, "admin.users.read");
    } catch (e) {
      expect((e as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("override enabled=false removes role-granted permission", async () => {
    await userAdminService.setPermissionOverride(
      dealerA,
      user1,
      "inventory.read",
      false,
      actorAdmin
    );
    const perms = await loadUserPermissions(user1, dealerA);
    expect(perms).not.toContain("inventory.read");
    expect(perms).toContain("inventory.write");
    await userAdminService.setPermissionOverride(
      dealerA,
      user1,
      "inventory.read",
      true,
      actorAdmin
    );
    const perms2 = await loadUserPermissions(user1, dealerA);
    expect(perms2).toContain("inventory.read");
  });

  it("override enabled=true grants permission not in any role", async () => {
    await userAdminService.setPermissionOverride(
      dealerA,
      user1,
      "admin.permissions.read",
      true,
      actorAdmin
    );
    const perms = await loadUserPermissions(user1, dealerA);
    expect(perms).toContain("admin.permissions.read");
    await userAdminService.setPermissionOverride(
      dealerA,
      user1,
      "admin.permissions.read",
      false,
      actorAdmin
    );
  });

  it("admin cannot modify users from other dealerships", async () => {
    await expect(
      userAdminService.assignRoles(dealerA, user2, [], actorAdmin)
    ).rejects.toThrow(ApiError);
    try {
      await userAdminService.assignRoles(dealerA, user2, [], actorAdmin);
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
    }
  });

  it("getDealerAuthContext returns roleKeys and effectivePermissions", async () => {
    const ctx = await getDealerAuthContext(user1, dealerA);
    expect(ctx.userId).toBe(user1);
    expect(ctx.dealershipId).toBe(dealerA);
    expect(ctx.roleIds.length).toBeGreaterThanOrEqual(1);
    expect(ctx.effectivePermissions.has("inventory.read")).toBe(true);
    expect(ctx.effectivePermissions.has("inventory.write")).toBe(true);
  });
});
