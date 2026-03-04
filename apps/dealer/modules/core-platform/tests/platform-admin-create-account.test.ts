/**
 * Platform Admin Create Account Flow: RBAC, tenant isolation, audit (no PII in metadata),
 * and abuse/validation (expired/cancelled invite, invalid roleId).
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

const requirePlatformAdminMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/platform-admin", () => ({
  requirePlatformAdmin: requirePlatformAdminMock,
  isPlatformAdmin: async () => true,
}));

const hasDb =
  process.env.SKIP_INTEGRATION_TESTS !== "1" && !!process.env.TEST_DATABASE_URL;

import { prisma } from "@/lib/db";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import * as pendingDb from "@/modules/platform-admin/db/pending-approval";

const platformAdminUserId = "d1000000-0000-0000-0000-000000000001";
const normalUserId = "d2000000-0000-0000-0000-000000000002";
const dealerAId = "e1000000-0000-0000-0000-000000000001";
const dealerBId = "e2000000-0000-0000-0000-000000000002";
const inviteeUserId = "e5000000-0000-0000-0000-000000000005";

async function ensureTestData(): Promise<{
  roleAId: string;
  roleBId: string;
}> {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Invite Test Dealer A", isActive: true },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Invite Test Dealer B", isActive: true },
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
  await prisma.profile.upsert({
    where: { id: inviteeUserId },
    create: { id: inviteeUserId, email: "invitee@test.local" },
    update: {},
  });
  await prisma.platformAdmin.upsert({
    where: { userId: platformAdminUserId },
    create: { userId: platformAdminUserId },
    update: {},
  });

  let roleA = await prisma.role.findFirst({
    where: { dealershipId: dealerAId, deletedAt: null },
  });
  if (!roleA) {
    roleA = await prisma.role.create({
      data: { dealershipId: dealerAId, name: "Owner", isSystem: false },
    });
  }
  let roleB = await prisma.role.findFirst({
    where: { dealershipId: dealerBId, deletedAt: null },
  });
  if (!roleB) {
    roleB = await prisma.role.create({
      data: { dealershipId: dealerBId, name: "Member", isSystem: false },
    });
  }
  return { roleAId: roleA.id, roleBId: roleB.id };
}

const getCurrentUserMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentUser: () => getCurrentUserMock(),
    requireUser: vi.fn(),
  };
});

const createServiceClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: (...args: unknown[]) => createServiceClientMock(...args),
}));

describe.skipIf(!hasDb)("Platform Admin Create Account — RBAC", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  // Use a random UUID for GET dealerships/[id] so we never leak 404 (non-platform gets 403 only).
  const randomDealerId = "f0000000-0000-0000-0000-000000000099";
  const platformRoutes = [
    {
      name: "GET /api/platform/dealerships",
      exec: async () => {
        const { GET } = await import("@/app/api/platform/dealerships/route");
        const req = new Request("http://localhost/api/platform/dealerships?limit=20&offset=0");
        return GET(req);
      },
    },
    {
      name: "GET /api/platform/dealerships/[id]",
      exec: async () => {
        const { GET } = await import("@/app/api/platform/dealerships/[id]/route");
        const req = new Request(`http://localhost/api/platform/dealerships/${randomDealerId}`);
        return GET(req, { params: Promise.resolve({ id: randomDealerId }) });
      },
    },
    {
      name: "GET /api/platform/dealerships/[id]/invites",
      exec: async () => {
        const { GET } = await import("@/app/api/platform/dealerships/[id]/invites/route");
        const req = new Request(
          `http://localhost/api/platform/dealerships/${dealerAId}/invites`
        );
        return GET(req, { params: Promise.resolve({ id: dealerAId }) });
      },
    },
    {
      name: "POST /api/platform/dealerships/[id]/invites",
      exec: async () => {
        const { POST } = await import("@/app/api/platform/dealerships/[id]/invites/route");
        const req = new Request(
          `http://localhost/api/platform/dealerships/${dealerAId}/invites`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: "newinvite@test.local",
              roleId: (await ensureTestData()).roleAId,
            }),
          }
        );
        return POST(req, { params: Promise.resolve({ id: dealerAId }) });
      },
    },
    {
      name: "PATCH /api/platform/dealerships/[id]/invites/[inviteId]",
      exec: async () => {
        const inviteId = "e0000000-0000-0000-0000-000000000000";
        const { PATCH } = await import(
          "@/app/api/platform/dealerships/[id]/invites/[inviteId]/route"
        );
        const req = new Request(
          `http://localhost/api/platform/dealerships/${dealerAId}/invites/${inviteId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cancel: true }),
          }
        );
        return PATCH(req, {
          params: Promise.resolve({ id: dealerAId, inviteId }),
        });
      },
    },
    {
      name: "GET /api/platform/pending-users",
      exec: async () => {
        const { GET } = await import("@/app/api/platform/pending-users/route");
        const req = new Request("http://localhost/api/platform/pending-users");
        return GET(req);
      },
    },
    {
      name: "POST /api/platform/pending-users/[userId]/approve",
      exec: async () => {
        const { POST } = await import(
          "@/app/api/platform/pending-users/[userId]/approve/route"
        );
        const req = new Request(
          `http://localhost/api/platform/pending-users/${inviteeUserId}/approve`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dealershipId: dealerAId, roleId: (await ensureTestData()).roleAId }),
          }
        );
        return POST(req, { params: Promise.resolve({ userId: inviteeUserId }) });
      },
    },
    {
      name: "POST /api/platform/pending-users/[userId]/reject",
      exec: async () => {
        const { POST } = await import(
          "@/app/api/platform/pending-users/[userId]/reject/route"
        );
        const req = new Request(
          `http://localhost/api/platform/pending-users/${inviteeUserId}/reject`,
          { method: "POST" }
        );
        return POST(req, { params: Promise.resolve({ userId: inviteeUserId }) });
      },
    },
  ] as const;

  it("non-platform-admin gets 403 on every platform route", async () => {
    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValue({
      userId: normalUserId,
      email: "normaluser@test.local",
    });
    const { ApiError } = await import("@/lib/auth");
    requirePlatformAdminMock.mockRejectedValue(
      new ApiError("FORBIDDEN", "Platform admin access required")
    );

    for (const { name, exec } of platformRoutes) {
      const res = await exec();
      expect(res.status, name).toBe(403);
      const body = await res.json();
      expect(body.error?.code, name).toBe("FORBIDDEN");
    }
  });

  it("platform admin can call GET dealerships and GET dealerships/[id]", async () => {
    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValue({
      userId: platformAdminUserId,
      email: "platformadmin@test.local",
    });
    requirePlatformAdminMock.mockResolvedValue(undefined);

    const { GET } = await import("@/app/api/platform/dealerships/route");
    const listRes = await GET(new Request("http://localhost/api/platform/dealerships?limit=20&offset=0"));
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.data)).toBe(true);

    const { GET: GETOne } = await import("@/app/api/platform/dealerships/[id]/route");
    const oneRes = await GETOne(
      new Request(`http://localhost/api/platform/dealerships/${dealerAId}`),
      { params: Promise.resolve({ id: dealerAId }) }
    );
    expect(oneRes.status).toBe(200);
    const oneBody = await oneRes.json();
    expect(oneBody.id).toBe(dealerAId);
  });

  it("platform admin can call GET invites, POST invite, GET pending-users", async () => {
    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValue({
      userId: platformAdminUserId,
      email: "platformadmin@test.local",
    });
    requirePlatformAdminMock.mockResolvedValue(undefined);
    const { roleAId } = await ensureTestData();

    const { GET } = await import("@/app/api/platform/dealerships/[id]/invites/route");
    const getInvRes = await GET(
      new Request(`http://localhost/api/platform/dealerships/${dealerAId}/invites`),
      { params: Promise.resolve({ id: dealerAId }) }
    );
    expect(getInvRes.status).toBe(200);
    const getInvBody = await getInvRes.json();
    expect(Array.isArray(getInvBody.data)).toBe(true);

    const { POST } = await import("@/app/api/platform/dealerships/[id]/invites/route");
    const postInvRes = await POST(
      new Request(
        `http://localhost/api/platform/dealerships/${dealerAId}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "rbac-invite@test.local",
            roleId: roleAId,
          }),
        }
      ),
      { params: Promise.resolve({ id: dealerAId }) }
    );
    expect([200, 201]).toContain(postInvRes.status);

    const { GET: GETPending } = await import("@/app/api/platform/pending-users/route");
    const pendingRes = await GETPending(
      new Request("http://localhost/api/platform/pending-users")
    );
    expect(pendingRes.status).toBe(200);
    const pendingBody = await pendingRes.json();
    expect(Array.isArray(pendingBody.data)).toBe(true);

    await prisma.dealershipInvite
      .deleteMany({ where: { dealershipId: dealerAId, email: "rbac-invite@test.local" } })
      .catch(() => {});
  });
});

describe.skipIf(!hasDb)("Platform Admin Create Account — Tenant isolation (accept invite)", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("accept invite creates membership with invite's roleId only (accept cannot escalate role)", async () => {
    await prisma.membership.deleteMany({
      where: { userId: inviteeUserId, dealershipId: dealerAId },
    });
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "invitee@test.local",
      roleId: roleAId,
      expiresAt: null,
      createdBy: platformAdminUserId,
      token,
    });

    getCurrentUserMock.mockResolvedValueOnce({ userId: inviteeUserId, email: "invitee@test.local" });
    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValueOnce({
      userId: inviteeUserId,
      email: "invitee@test.local",
    });

    const { POST } = await import("@/app/api/invite/accept/route");
    const req = new Request("http://localhost/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.dealershipId).toBe(dealerAId);
    expect(body.data?.membershipId).toBeDefined();

    const membership = await prisma.membership.findFirst({
      where: { id: body.data.membershipId },
    });
    expect(membership).toBeDefined();
    expect(membership?.dealershipId).toBe(dealerAId);
    expect(membership?.userId).toBe(inviteeUserId);
    expect(membership?.roleId).toBe(roleAId);
    expect(membership?.roleId).toBe(invite.roleId);

    await prisma.membership.delete({ where: { id: body.data.membershipId } }).catch(() => {});
    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });
});

describe.skipIf(!hasDb)("Platform Admin Create Account — Audit (no PII in metadata)", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  const allowedMetaKeys = new Set([
    "inviteId",
    "dealershipId",
    "roleId",
    "membershipId",
    "userId",
    "acceptedByUserId",
    "changedFields",
  ]);
  const piiKeys = new Set(["email", "phone", "fullName", "ssn", "dob", "income"]);

  function assertNoPiiInMetadata(metadata: Record<string, unknown> | null) {
    if (!metadata) return;
    for (const key of Object.keys(metadata)) {
      const keyLower = key.toLowerCase();
      expect(piiKeys.has(keyLower), `metadata must not contain PII key: ${key}`).toBe(false);
    }
    for (const key of Object.keys(metadata)) {
      expect(
        allowedMetaKeys.has(key),
        `metadata key ${key} should be one of: ${[...allowedMetaKeys].join(", ")}`
      ).toBe(true);
    }
  }

  it("createInvite writes platform.invite.created and metadata has no PII", async () => {
    const { roleAId } = await ensureTestData();
    const { createInvite: createInviteSvc } = await import(
      "@/modules/platform-admin/service/invite"
    );
    const result = await createInviteSvc({
      dealershipId: dealerAId,
      email: "audit-invite@test.local",
      roleId: roleAId,
      actorUserId: platformAdminUserId,
    });
    const inviteId = result.invite.id;

    const entry = await prisma.auditLog.findFirst({
      where: { action: "platform.invite.created", entity: "DealershipInvite", entityId: inviteId },
      orderBy: { createdAt: "desc" },
    });
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("platform.invite.created");
    assertNoPiiInMetadata(entry?.metadata as Record<string, unknown> | null);

    await prisma.dealershipInvite
      .deleteMany({ where: { email: "audit-invite@test.local" } })
      .catch(() => {});
  });

  it("acceptInvite writes platform.invite.accepted and metadata has no PII", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "audit-accept@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });
    const inviteeProfile = await prisma.profile.upsert({
      where: { id: "e6000000-0000-0000-0000-000000000006" },
      create: {
        id: "e6000000-0000-0000-0000-000000000006",
        email: "audit-accept@test.local",
      },
      update: {},
    });

    const { acceptInvite } = await import("@/modules/platform-admin/service/invite");
    await acceptInvite({
      token,
      actorUserId: inviteeProfile.id,
      actorEmail: "audit-accept@test.local",
    });

    const entry = await prisma.auditLog.findFirst({
      where: { action: "platform.invite.accepted", entityId: invite.id },
      orderBy: { createdAt: "desc" },
    });
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("platform.invite.accepted");
    assertNoPiiInMetadata(entry?.metadata as Record<string, unknown> | null);

    await prisma.membership
      .deleteMany({ where: { userId: inviteeProfile.id, dealershipId: dealerAId } })
      .catch(() => {});
    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
    await prisma.profile.delete({ where: { id: inviteeProfile.id } }).catch(() => {});
  });

  it("cancelInvite writes platform.invite.cancelled and metadata has no PII", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "audit-cancel@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });

    const { cancelInvite } = await import("@/modules/platform-admin/service/invite");
    await cancelInvite(dealerAId, invite.id, platformAdminUserId);

    const entry = await prisma.auditLog.findFirst({
      where: { action: "platform.invite.cancelled", entityId: invite.id },
      orderBy: { createdAt: "desc" },
    });
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("platform.invite.cancelled");
    assertNoPiiInMetadata(entry?.metadata as Record<string, unknown> | null);
  });

  it("approvePendingUser writes platform.membership.approved and metadata has no PII", async () => {
    const { roleAId } = await ensureTestData();
    const pendingUserId = "e7000000-0000-0000-0000-000000000007";
    await prisma.profile.upsert({
      where: { id: pendingUserId },
      create: { id: pendingUserId, email: "pending-approve@test.local" },
      update: {},
    });
    await prisma.pendingApproval.deleteMany({ where: { userId: pendingUserId } }).catch(() => {});
    await pendingDb.createPendingApproval(pendingUserId, "pending-approve@test.local");

    const { approvePendingUser } = await import(
      "@/modules/platform-admin/service/pending-users"
    );
    await approvePendingUser({
      userId: pendingUserId,
      dealershipId: dealerAId,
      roleId: roleAId,
      actorUserId: platformAdminUserId,
    });

    const entry = await prisma.auditLog.findFirst({
      where: { action: "platform.membership.approved" },
      orderBy: { createdAt: "desc" },
    });
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("platform.membership.approved");
    assertNoPiiInMetadata(entry?.metadata as Record<string, unknown> | null);

    await prisma.membership
      .deleteMany({ where: { userId: pendingUserId, dealershipId: dealerAId } })
      .catch(() => {});
    await prisma.pendingApproval.deleteMany({ where: { userId: pendingUserId } }).catch(() => {});
    await prisma.profile.delete({ where: { id: pendingUserId } }).catch(() => {});
  });

  it("rejectPendingUser writes platform.pending.rejected and metadata has no PII", async () => {
    const pendingUserId = "e8000000-0000-0000-0000-000000000008";
    await prisma.profile.upsert({
      where: { id: pendingUserId },
      create: { id: pendingUserId, email: "pending-reject@test.local" },
      update: {},
    });
    await prisma.pendingApproval.deleteMany({ where: { userId: pendingUserId } }).catch(() => {});
    await pendingDb.createPendingApproval(pendingUserId, "pending-reject@test.local");

    const { rejectPendingUser } = await import(
      "@/modules/platform-admin/service/pending-users"
    );
    await rejectPendingUser(pendingUserId, platformAdminUserId);

    const entry = await prisma.auditLog.findFirst({
      where: { action: "platform.pending.rejected" },
      orderBy: { createdAt: "desc" },
    });
    expect(entry).toBeDefined();
    expect(entry?.action).toBe("platform.pending.rejected");
    assertNoPiiInMetadata(entry?.metadata as Record<string, unknown> | null);

    await prisma.profile.delete({ where: { id: pendingUserId } }).catch(() => {});
  });
});

describe.skipIf(!hasDb)("Platform Admin Create Account — Abuse / validation", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("accept invite with expired token returns 410", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "expired@test.local",
      roleId: roleAId,
      expiresAt: new Date(Date.now() - 86400000),
      createdBy: platformAdminUserId,
      token,
    });

    getCurrentUserMock.mockResolvedValueOnce({ userId: inviteeUserId, email: "expired@test.local" });
    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValueOnce({
      userId: inviteeUserId,
      email: "expired@test.local",
    });

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_EXPIRED");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("accept invite with cancelled invite returns 410", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "cancelled@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });
    await inviteDb.updateInviteStatus(invite.id, "CANCELLED");

    getCurrentUserMock.mockResolvedValueOnce({
      userId: inviteeUserId,
      email: "cancelled@test.local",
    });

    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValueOnce({
      userId: inviteeUserId,
      email: "cancelled@test.local",
    });

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_EXPIRED");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("resolve with expired invite returns 410", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "resolve-expired@test.local",
      roleId: roleAId,
      expiresAt: new Date(Date.now() - 86400000),
      createdBy: platformAdminUserId,
      token,
    });

    const { GET } = await import("@/app/api/invite/resolve/route");
    const res = await GET(
      new Request(`http://localhost/api/invite/resolve?token=${token}`)
    );
    expect(res.status).toBe(410);
    const resolveBody = await res.json();
    expect(resolveBody.error?.code).toBe("INVITE_EXPIRED");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("resolve with cancelled invite returns 410", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "resolve-cancelled@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });
    await inviteDb.updateInviteStatus(invite.id, "CANCELLED");

    const { GET } = await import("@/app/api/invite/resolve/route");
    const res = await GET(
      new Request(`http://localhost/api/invite/resolve?token=${token}`)
    );
    expect(res.status).toBe(410);
    const resolveBody = await res.json();
    expect(resolveBody.error?.code).toBe("INVITE_EXPIRED");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("resolve with accepted invite returns 410 (one-time use)", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "resolve-accepted@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });
    await inviteDb.updateInviteStatus(invite.id, "ACCEPTED", new Date());

    const { GET } = await import("@/app/api/invite/resolve/route");
    const res = await GET(
      new Request(`http://localhost/api/invite/resolve?token=${token}`)
    );
    expect(res.status).toBe(410);
    const resolveBody = await res.json();
    expect(resolveBody.error?.code).toBe("INVITE_ALREADY_ACCEPTED");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("resolve returns 200 with emailMasked when invite is pending", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "signup-flow@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });

    const { GET } = await import("@/app/api/invite/resolve/route");
    const res = await GET(new Request(`http://localhost/api/invite/resolve?token=${token}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.inviteId).toBe(invite.id);
    expect(body.data?.dealershipName).toBeDefined();
    expect(body.data?.roleName).toBeDefined();
    expect(body.data?.emailMasked).toBe("s***@test.local");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("resolve with unknown token returns 404 INVITE_NOT_FOUND", async () => {
    const { GET } = await import("@/app/api/invite/resolve/route");
    const res = await GET(
      new Request("http://localhost/api/invite/resolve?token=unknown-token-xyz")
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_NOT_FOUND");
  });

  it("accept when user already has membership returns 200 with membershipId (idempotent)", async () => {
    const { roleAId } = await ensureTestData();
    await prisma.membership.deleteMany({
      where: { userId: inviteeUserId, dealershipId: dealerAId },
    });
    const existingMembership = await prisma.membership.create({
      data: {
        dealershipId: dealerAId,
        userId: inviteeUserId,
        roleId: roleAId,
        invitedBy: platformAdminUserId,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
    });
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "invitee@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });

    getCurrentUserMock.mockResolvedValueOnce({ userId: inviteeUserId, email: "invitee@test.local" });
    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValueOnce({
      userId: inviteeUserId,
      email: "invitee@test.local",
    });

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.membershipId).toBe(existingMembership.id);
    expect(body.data?.dealershipId).toBe(dealerAId);
    expect(body.data?.alreadyHadMembership).toBe(true);

    await prisma.membership.delete({ where: { id: existingMembership.id } }).catch(() => {});
    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("accept when invite already accepted (used) returns 410 INVITE_ALREADY_ACCEPTED", async () => {
    const { roleAId } = await ensureTestData();
    await prisma.membership.deleteMany({
      where: { userId: inviteeUserId, dealershipId: dealerAId },
    });
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "invitee@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });
    await inviteDb.updateInviteStatus(invite.id, "ACCEPTED", new Date());

    getCurrentUserMock.mockResolvedValueOnce({ userId: inviteeUserId, email: "invitee@test.local" });
    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValueOnce({
      userId: inviteeUserId,
      email: "invitee@test.local",
    });

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_ALREADY_ACCEPTED");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("approve pending user with roleId not in dealership returns 404", async () => {
    const { roleBId } = await ensureTestData();
    const pendingUserId = "e9000000-0000-0000-0000-000000000009";
    await prisma.profile.upsert({
      where: { id: pendingUserId },
      create: { id: pendingUserId, email: "approve-bad-role@test.local" },
      update: {},
    });
    await prisma.pendingApproval.deleteMany({ where: { userId: pendingUserId } }).catch(() => {});
    await pendingDb.createPendingApproval(pendingUserId, "approve-bad-role@test.local");

    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValue({
      userId: platformAdminUserId,
      email: "platformadmin@test.local",
    });

    const { POST } = await import(
      "@/app/api/platform/pending-users/[userId]/approve/route"
    );
    const res = await POST(
      new Request(
        `http://localhost/api/platform/pending-users/${pendingUserId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealershipId: dealerAId,
            roleId: roleBId,
          }),
        }
      ),
      { params: Promise.resolve({ userId: pendingUserId }) }
    );
    expect([400, 404]).toContain(res.status);
    const body = await res.json();
    expect(body.error?.code).toBeDefined();

    await prisma.pendingApproval.deleteMany({ where: { userId: pendingUserId } }).catch(() => {});
    await prisma.profile.delete({ where: { id: pendingUserId } }).catch(() => {});
  });

  it("create invite with roleId for different dealership returns 404", async () => {
    const { roleBId } = await ensureTestData();

    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValue({
      userId: platformAdminUserId,
      email: "platformadmin@test.local",
    });

    const { POST } = await import("@/app/api/platform/dealerships/[id]/invites/route");
    const res = await POST(
      new Request(
        `http://localhost/api/platform/dealerships/${dealerAId}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "cross-role-invite@test.local",
            roleId: roleBId,
          }),
        }
      ),
      { params: Promise.resolve({ id: dealerAId }) }
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe("NOT_FOUND");
  });
});

describe.skipIf(!hasDb)("Invite signup flow", () => {
  const signupUserId = "ea000000-0000-0000-0000-00000000000a";

  beforeAll(async () => {
    await ensureTestData();
  });

  it("accept (signup) creates profile, membership, marks invite with acceptedByUserId (tenant from invite only)", async () => {
    const { roleAId } = await ensureTestData();
    createServiceClientMock.mockReturnValueOnce({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: signupUserId } },
            error: null,
          }),
        },
      },
    });

    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "signup-accept@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });

    getCurrentUserMock.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: "signup-accept@test.local",
          password: "SecurePass12!word",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.membershipId).toBeDefined();
    expect(body.data?.dealershipId).toBe(dealerAId);

    const membership = await prisma.membership.findFirst({
      where: { id: body.data.membershipId },
    });
    expect(membership).toBeDefined();
    expect(membership?.dealershipId).toBe(dealerAId);
    expect(membership?.userId).toBe(signupUserId);
    expect(membership?.inviteId).toBe(invite.id);

    const updatedInvite = await prisma.dealershipInvite.findUnique({
      where: { id: invite.id },
    });
    expect(updatedInvite?.status).toBe("ACCEPTED");
    expect(updatedInvite?.acceptedByUserId).toBe(signupUserId);

    await prisma.membership.delete({ where: { id: body.data.membershipId } }).catch(() => {});
    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
    await prisma.profile.delete({ where: { id: signupUserId } }).catch(() => {});
  });

  it("accept (signup) with dealershipId in body ignores it — membership created for invite's dealership only", async () => {
    const { roleAId } = await ensureTestData();
    const signupUserBId = "eb000000-0000-0000-0000-00000000000b";
    createServiceClientMock.mockReturnValueOnce({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: signupUserBId } },
            error: null,
          }),
        },
      },
    });

    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "tenant-isolation@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });

    getCurrentUserMock.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: "tenant-isolation@test.local",
          password: "SecurePass12!word",
          dealershipId: dealerBId,
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.dealershipId).toBe(dealerAId);
    expect(body.data?.dealershipId).not.toBe(dealerBId);

    const membership = await prisma.membership.findFirst({
      where: { id: body.data.membershipId },
    });
    expect(membership).toBeDefined();
    expect(membership?.dealershipId).toBe(dealerAId);
    expect(membership?.userId).toBe(signupUserBId);

    await prisma.membership.delete({ where: { id: body.data.membershipId } }).catch(() => {});
    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
    await prisma.profile.delete({ where: { id: signupUserBId } }).catch(() => {});
  });

  it("second accept (signup) with same token fails 410", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "signup-twice@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });
    await inviteDb.updateInviteStatus(invite.id, "ACCEPTED", new Date(), signupUserId);

    getCurrentUserMock.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: "signup-twice@test.local",
          password: "SecurePass12!word",
        }),
      })
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_ALREADY_ACCEPTED");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("accept (signup) email mismatch returns 403 with fieldErrors", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "invite-email@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });

    getCurrentUserMock.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: "wrong-email@test.local",
          password: "SecurePass12!word",
        }),
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_EMAIL_MISMATCH");
    expect(body.error?.details?.fieldErrors?.email).toBeDefined();

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("accept (signup) password too weak returns 400 with fieldErrors", async () => {
    const { roleAId } = await ensureTestData();
    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "weak-pwd@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });

    getCurrentUserMock.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: "weak-pwd@test.local",
          password: "short",
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.details?.fieldErrors?.password).toBeDefined();

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });

  it("accept (signup) EMAIL_ALREADY_REGISTERED 409 when Supabase reports user exists", async () => {
    const { roleAId } = await ensureTestData();
    createServiceClientMock.mockReturnValueOnce({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "A user with this email already has an account." },
          }),
        },
      },
    });

    const token = inviteDb.generateInviteToken();
    const invite = await inviteDb.createInvite({
      dealershipId: dealerAId,
      email: "already-registered@test.local",
      roleId: roleAId,
      createdBy: platformAdminUserId,
      token,
    });

    getCurrentUserMock.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/invite/accept/route");
    const res = await POST(
      new Request("http://localhost/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email: "already-registered@test.local",
          password: "SecurePass12!word",
        }),
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error?.code).toBe("EMAIL_ALREADY_REGISTERED");

    await prisma.dealershipInvite.delete({ where: { id: invite.id } }).catch(() => {});
  });
});
