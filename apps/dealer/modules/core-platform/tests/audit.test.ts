/** @jest-environment node */
/**
 * Audit: changing membership role writes an AuditLog row with expected fields (no PII).
 * Also role.updated (permission change) and file.accessed.
 */
jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://example.com/signed" }, error: null }),
      }),
    },
  }),
}));

import { prisma } from "@/lib/db";
import * as membershipService from "../service/membership";
import * as roleService from "../service/role";
import * as fileDb from "../db/file";
import * as fileService from "../service/file";

const dealerId = "60000000-0000-0000-0000-000000000006";
const actorId = "70000000-0000-0000-0000-000000000007";
const memberUserId = "80000000-0000-0000-0000-000000000008";

async function ensureTestData(): Promise<{ membershipId: string; roleId2: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Audit Test Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: actorId },
    create: { id: actorId, email: "actor@test.local" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: memberUserId },
    create: { id: memberUserId, email: "member@test.local" },
    update: {},
  });
  const permIds = (await prisma.permission.findMany({ take: 2 })).map((p) => p.id);
  const role1 = await prisma.role.upsert({
    where: { id: "60000000-0000-0000-0001-000000000006" },
    create: {
      id: "60000000-0000-0000-0001-000000000006",
      dealershipId: dealerId,
      name: "Role1",
      isSystem: false,
      rolePermissions: { create: permIds.map((id) => ({ permissionId: id })) },
    },
    update: {},
  });
  const role2 = await prisma.role.upsert({
    where: { id: "60000000-0000-0000-0002-000000000006" },
    create: {
      id: "60000000-0000-0000-0002-000000000006",
      dealershipId: dealerId,
      name: "Role2",
      isSystem: false,
      rolePermissions: { create: permIds.map((id) => ({ permissionId: id })) },
    },
    update: {},
  });
  const membership = await prisma.membership.upsert({
    where: { id: "60000000-0000-0000-0003-000000000006" },
    create: {
      id: "60000000-0000-0000-0003-000000000006",
      dealershipId: dealerId,
      userId: memberUserId,
      roleId: role1.id,
    },
    update: {},
  });
  return { membershipId: membership.id, roleId2: role2.id };
}

describe("Audit", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("updating membership role creates audit log row with expected action and entity", async () => {
    const { membershipId, roleId2 } = await ensureTestData();
    await prisma.membership.update({
      where: { id: membershipId },
      data: { roleId: "60000000-0000-0000-0001-000000000006" },
    });
    await membershipService.updateMembership(
      dealerId,
      membershipId,
      actorId,
      { roleId: roleId2 },
      { ip: "127.0.0.1" }
    );
    const after = await prisma.auditLog.findFirst({
      where: { dealershipId: dealerId, entity: "Membership", action: "membership.role_changed" },
      orderBy: { createdAt: "desc" },
    });
    expect(after).toBeDefined();
    expect(after?.actorId).toBe(actorId);
    expect(after?.entityId).toBe(membershipId);
    expect(after?.metadata).toBeDefined();
    const meta = after?.metadata as Record<string, unknown> | null;
    expect(meta?.roleId).toBeDefined();
    expect(meta?.previousRoleId).toBeDefined();
    expect(meta?.email).toBeUndefined();
    expect(meta?.ssn).toBeUndefined();
  });

  it("updating role permissions creates audit log row role.updated with safe metadata", async () => {
    const { roleId2 } = await ensureTestData();
    const roleToUpdate = await prisma.role.findFirst({
      where: { dealershipId: dealerId, id: roleId2, deletedAt: null },
      include: { rolePermissions: { include: { permission: true } } },
    });
    if (!roleToUpdate) return;
    const allPerms = await prisma.permission.findMany({ take: 3 });
    const newPermIds = allPerms.map((p) => p.id).filter((id) => id !== roleToUpdate.rolePermissions[0]?.permissionId);
    if (newPermIds.length === 0) return;
    await roleService.updateRole(
      dealerId,
      roleId2,
      actorId,
      { permissionIds: newPermIds },
      { ip: "127.0.0.1" }
    );
    const after = await prisma.auditLog.findFirst({
      where: { dealershipId: dealerId, entity: "Role", action: "role.updated" },
      orderBy: { createdAt: "desc" },
    });
    expect(after).toBeDefined();
    expect(after?.entityId).toBe(roleId2);
    const meta = after?.metadata as Record<string, unknown> | null;
    expect(meta?.permissionIds).toBeDefined();
    expect(meta?.email).toBeUndefined();
  });

  it("getSignedUrl creates file.accessed audit log row when signed URL is issued", async () => {
    const file = await fileDb.createFileObject({
      dealershipId: dealerId,
      bucket: "deal-documents",
      path: `${dealerId}/deal-documents/audit-test.pdf`,
      filename: "audit-test.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
      uploadedBy: actorId,
    });
    await fileService.getSignedUrl(dealerId, file.id, actorId, { ip: "127.0.0.1" });
    const accessed = await prisma.auditLog.findFirst({
      where: { dealershipId: dealerId, entity: "FileObject", action: "file.accessed", entityId: file.id },
      orderBy: { createdAt: "desc" },
    });
    expect(accessed).toBeDefined();
    expect(accessed?.actorId).toBe(actorId);
    await prisma.fileObject.delete({ where: { id: file.id } });
  });
});
