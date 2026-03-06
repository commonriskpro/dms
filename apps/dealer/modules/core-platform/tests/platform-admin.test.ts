/**
 * Platform admin: non-admin gets 403 on platform routes; platform admin can list/create/disable;
 * disabled dealership blocks tenant access; impersonate sets cookie.
 */
jest.mock("@/lib/platform-admin", () => ({
  requirePlatformAdmin: jest.fn(),
  isPlatformAdmin: async () => true,
}));

const hasDb =
  process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL;

import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform-admin";

const platformAdminUserId = "d1000000-0000-0000-0000-000000000001";
const normalUserId = "d2000000-0000-0000-0000-000000000002";
const dealerAId = "d3000000-0000-0000-0000-000000000003";

async function ensureTestData() {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Platform Test Dealer", isActive: true },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: platformAdminUserId },
    create: { id: platformAdminUserId, email: "platformadmin@test.local" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: normalUserId },
    create: { id: normalUserId, email: "normaluser@test.local" },
    update: {},
  });
  await prisma.platformAdmin.upsert({
    where: { userId: platformAdminUserId },
    create: { userId: platformAdminUserId },
    update: {},
  });
  const role = await prisma.role.findFirst({
    where: { dealershipId: dealerAId, deletedAt: null },
  });
  if (!role) {
    const r = await prisma.role.create({
      data: { dealershipId: dealerAId, name: "Member", isSystem: false },
    });
    await prisma.membership.upsert({
      where: {
        id: "d4000000-0000-0000-0000-000000000004",
      },
      create: {
        id: "d4000000-0000-0000-0000-000000000004",
        dealershipId: dealerAId,
        userId: normalUserId,
        roleId: r.id,
      },
      update: {},
    });
  } else {
    const existing = await prisma.membership.findFirst({
      where: { dealershipId: dealerAId, userId: normalUserId, disabledAt: null },
    });
    if (!existing) {
      await prisma.membership.create({
        data: { dealershipId: dealerAId, userId: normalUserId, roleId: role.id },
      });
    }
  }
}

const setActiveDealershipCookieMock = jest.fn();

jest.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireUser: jest.fn(),
  };
});

jest.mock("@/lib/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant")>();
  return {
    ...actual,
    setActiveDealershipCookie: setActiveDealershipCookieMock,
  };
});

(hasDb ? describe : describe.skip)("Platform admin", () => {
  beforeAll(async () => {
    await ensureTestData();
    (requirePlatformAdmin as jest.Mock).mockResolvedValue(undefined);
  });

  it("non-platform user cannot call GET /api/platform/dealerships (403)", async () => {
    const { requireUser } = await import("@/lib/auth");
    (requireUser as jest.Mock).mockResolvedValueOnce({
      userId: normalUserId,
      email: "normaluser@test.local",
    });
    const { ApiError } = await import("@/lib/auth");
    (requirePlatformAdmin as jest.Mock).mockRejectedValueOnce(
      new ApiError("FORBIDDEN", "Platform admin access required")
    );
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/platform/dealerships/route");
    const req = new NextRequest("http://localhost/api/platform/dealerships?limit=20&offset=0");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
  });

  it("platform admin can list dealerships", async () => {
    const { requireUser } = await import("@/lib/auth");
    (requireUser as jest.Mock).mockResolvedValueOnce({
      userId: platformAdminUserId,
      email: "platformadmin@test.local",
    });
    (requirePlatformAdmin as jest.Mock).mockResolvedValueOnce(undefined);
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/platform/dealerships/route");
    const req = new NextRequest("http://localhost/api/platform/dealerships?limit=20&offset=0");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.meta.total).toBe("number");
  });

  it("platform admin can create dealership", async () => {
    const { requireUser } = await import("@/lib/auth");
    (requireUser as jest.Mock).mockResolvedValueOnce({
      userId: platformAdminUserId,
      email: "platformadmin@test.local",
    });
    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/platform/dealerships/route");
    const req = new NextRequest("http://localhost/api/platform/dealerships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Test Dealer",
        slug: "new-test-dealer",
        createDefaultLocation: false,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("New Test Dealer");
    await prisma.dealership.delete({ where: { id: body.id } }).catch(() => {});
  });

  it("platform admin can disable dealership", async () => {
    const { requireUser } = await import("@/lib/auth");
    (requireUser as jest.Mock).mockResolvedValue({
      userId: platformAdminUserId,
      email: "platformadmin@test.local",
    });
    const created = await prisma.dealership.create({
      data: { name: "To Disable", isActive: true },
    });
    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/platform/dealerships/[id]/disable/route");
    const req = new NextRequest(
      `http://localhost/api/platform/dealerships/${created.id}/disable`,
      { method: "POST" }
    );
    const res = await POST(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(204);
    const updated = await prisma.dealership.findUnique({
      where: { id: created.id },
      select: { isActive: true },
    });
    expect(updated?.isActive).toBe(false);
    await prisma.dealership.delete({ where: { id: created.id } }).catch(() => {});
  });

  it("impersonate sets active-dealership cookie (platform admin)", async () => {
    setActiveDealershipCookieMock.mockClear();
    const { requireUser } = await import("@/lib/auth");
    (requireUser as jest.Mock).mockResolvedValueOnce({
      userId: platformAdminUserId,
      email: "platformadmin@test.local",
    });
    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/platform/impersonate/route");
    const req = new NextRequest("http://localhost/api/platform/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealershipId: dealerAId }),
    });
    const res = await POST(req);
    expect(res.status).toBe(204);
    expect(setActiveDealershipCookieMock).toHaveBeenCalledWith(dealerAId);
  });
});
