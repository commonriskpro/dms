/** @jest-environment node */
/**
 * RBAC: documents.read required for list + signed-url; documents.write for upload/delete/patch.
 * Uses a self-contained fixture (dealership, user, role without documents.*, membership).
 */
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";


const dealerId = "b1000000-0000-0000-0000-000000000001";
const userId = "b2000000-0000-0000-0000-000000000002";
const roleId = "b3000000-0000-0000-0000-000000000003";
const membershipId = "b4000000-0000-0000-0000-000000000004";

async function ensureFixture(): Promise<{ userId: string; dealerId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Documents RBAC Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: "doc-rbac-user@test.local" },
    update: {},
  });
  const permOther = await prisma.permission.findFirst({
    where: { key: "admin.dealership.read" },
  });
  if (!permOther) throw new Error("Permission admin.dealership.read not found (seed first)");
  await prisma.role.upsert({
    where: { id: roleId },
    create: {
      id: roleId,
      dealershipId: dealerId,
      name: "NoDocuments",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permOther.id }] },
    },
    update: {},
  });
  const existing = await prisma.membership.findFirst({
    where: { dealershipId: dealerId, userId, disabledAt: null },
  });
  if (existing) {
    await prisma.membership.update({
      where: { id: existing.id },
      data: { roleId },
    });
  } else {
    await prisma.membership.create({
      data: {
        id: membershipId,
        dealershipId: dealerId,
        userId,
        roleId,
      },
    });
  }
  return { userId, dealerId };
}

describe("Documents RBAC", () => {
  let fixture: { userId: string; dealerId: string };

  beforeAll(async () => {
    fixture = await ensureFixture();
  });

  it("requirePermission(documents.read) throws FORBIDDEN when user lacks it", async () => {
    await expect(
      requirePermission(fixture.userId, fixture.dealerId, "documents.read")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requirePermission(documents.write) throws FORBIDDEN when user lacks it", async () => {
    await expect(
      requirePermission(fixture.userId, fixture.dealerId, "documents.write")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
