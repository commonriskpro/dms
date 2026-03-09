/** @jest-environment node */
/**
 * Session switch: PATCH with dealershipId user is not a member of returns FORBIDDEN
 * and active dealership cookie is not set.
 */
import { prisma } from "@/lib/db";

const userAId = "b1000000-0000-0000-0000-000000000001";
const dealerAId = "b2000000-0000-0000-0000-000000000002";
const dealerBId = "b3000000-0000-0000-0000-000000000003";

async function ensureTestData() {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Switch Test A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Switch Test B" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userAId },
    create: { id: userAId, email: "switchuser@test.local" },
    update: {},
  });
  const roleA = await prisma.role.findFirst({
    where: { dealershipId: dealerAId, deletedAt: null },
  });
  if (!roleA) {
    const r = await prisma.role.create({
      data: { dealershipId: dealerAId, name: "RoleA", isSystem: false },
    });
    await prisma.membership.upsert({
      where: { id: "b4000000-0000-0000-0000-000000000004" },
      create: {
        id: "b4000000-0000-0000-0000-000000000004",
        dealershipId: dealerAId,
        userId: userAId,
        roleId: r.id,
      },
      update: {},
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
  const membershipB = await prisma.membership.findFirst({
    where: { dealershipId: dealerBId, userId: userAId, disabledAt: null },
  });
  if (membershipB) {
    await prisma.membership.update({
      where: { id: membershipB.id },
      data: { disabledAt: new Date(), disabledBy: userAId },
    });
  }
}

const setActiveDealershipCookieMock = jest.fn();

jest.mock("@/lib/tenant", () => {
  const actual = jest.requireActual<typeof import("@/lib/tenant")>("@/lib/tenant");
  return {
    ...actual,
    setActiveDealershipCookie: setActiveDealershipCookieMock,
  };
});

jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual<typeof import("@/lib/auth")>("@/lib/auth");
  const mockUser = { userId: userAId, email: "switchuser@test.local" };
  return {
    ...actual,
    requireUser: jest.fn().mockResolvedValue(mockUser),
    requireUserFromRequest: jest.fn().mockResolvedValue(mockUser),
  };
});

describe("Session switch", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("PATCH session/switch with dealershipId user is not a member of returns FORBIDDEN and cookie is not set", async () => {
    setActiveDealershipCookieMock.mockClear();
    const { NextRequest } = await import("next/server");
    const { PATCH } = await import("@/app/api/auth/session/switch/route");
    const nextRequest = new NextRequest("http://localhost/api/auth/session/switch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealershipId: dealerBId }),
    });
    const response = await PATCH(nextRequest);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(setActiveDealershipCookieMock).not.toHaveBeenCalled();
  });
});
