/** @jest-environment node */
/**
 * Tenant isolation: Dealer A cannot read or modify Dealer B data.
 * Requires DATABASE_URL and run migrations + seed first.
 */
import { prisma } from "@/lib/db";
import * as membershipDb from "../db/membership";
import * as roleDb from "../db/role";
import * as auditDb from "../db/audit";
import * as locationDb from "../db/location";

const dealerAId = "10000000-0000-0000-0000-000000000001";
const dealerBId = "20000000-0000-0000-0000-000000000002";
const userAId = "30000000-0000-0000-0000-000000000003";

async function ensureTestData() {
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
    create: { id: userAId, email: "usera@test.local" },
    update: {},
  });
  const roleA = await prisma.role.findFirst({
    where: { dealershipId: dealerAId, deletedAt: null },
  });
  if (!roleA) {
    const r = await prisma.role.create({
      data: { dealershipId: dealerAId, name: "TestRole", isSystem: false },
    });
    await prisma.membership.create({
      data: { dealershipId: dealerAId, userId: userAId, roleId: r.id },
    });
  } else {
    const existing = await prisma.membership.findFirst({
      where: { dealershipId: dealerAId, userId: userAId, disabledAt: null },
    });
    if (!existing) {
      await prisma.membership.create({
        data: { dealershipId: dealerAId, userId: userAId, roleId: roleA.id },
      });
    }
  }
}

describe("Tenant isolation", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("listMemberships for Dealer B does not return Dealer A members", async () => {
    const { data } = await membershipDb.listMemberships(dealerBId, {
      limit: 25,
      offset: 0,
    });
    const dealerAMembers = data.filter((m) => m.dealershipId === dealerAId);
    expect(dealerAMembers).toHaveLength(0);
  });

  it("getMembershipById with wrong dealership returns null", async () => {
    const membershipA = await prisma.membership.findFirst({
      where: { dealershipId: dealerAId, userId: userAId },
    });
    if (!membershipA) return;
    const found = await membershipDb.getMembershipById(dealerBId, membershipA.id);
    expect(found).toBeNull();
  });

  it("listAuditLogs for Dealer B does not return Dealer A audit rows", async () => {
    await prisma.auditLog.create({
      data: {
        dealershipId: dealerAId,
        actorId: userAId,
        action: "test.action",
        entity: "Test",
      },
    });
    const { data } = await auditDb.listAuditLogs(dealerBId, 25, 0);
    const fromA = data.filter((a) => a.dealershipId === dealerAId);
    expect(fromA).toHaveLength(0);
    await prisma.auditLog.deleteMany({
      where: { dealershipId: dealerAId, action: "test.action" },
    });
  });

  it("getRoleById with wrong dealership returns null", async () => {
    const roleA = await prisma.role.findFirst({
      where: { dealershipId: dealerAId, deletedAt: null },
    });
    if (!roleA) return;
    const found = await roleDb.getRoleById(dealerBId, roleA.id);
    expect(found).toBeNull();
  });

  it("getLocationById with wrong dealership returns null", async () => {
    const loc = await prisma.dealershipLocation.findFirst({
      where: { dealershipId: dealerAId },
    });
    if (!loc) return;
    const found = await locationDb.getLocationById(dealerBId, loc.id);
    expect(found).toBeNull();
  });
});
