/**
 * Platform owner-invite: PLATFORM_OWNER only; non-owner gets 403 before lookup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
const PlatformApiErrorClass = vi.hoisted(() => {
  class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  }
  return PlatformApiError;
});
vi.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: requirePlatformAuthMock,
  requirePlatformRole: requirePlatformRoleMock,
  PlatformApiError: PlatformApiErrorClass,
}));

const callDealerOwnerInviteMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/call-dealer-internal", () => ({
  callDealerOwnerInvite: callDealerOwnerInviteMock,
}));

const sendOwnerInviteEmailMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/resend", () => ({
  sendOwnerInviteEmail: sendOwnerInviteEmailMock,
}));

vi.mock("@/lib/hash", () => ({
  hashEmail: (email: string) => `hash-${email.toLowerCase().trim()}`,
}));

const platformAuditLogMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audit", () => ({
  platformAuditLog: platformAuditLogMock,
}));

const prismaMock = vi.hoisted(() => ({
  dealershipMapping: { findUnique: vi.fn() },
  platformEmailLog: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "./route";

function setupSuccessMocks(acceptUrl = "https://dealer.example.com/accept-invite?token=abc") {
  prismaMock.dealershipMapping.findUnique.mockResolvedValue({
    platformDealershipId: "platform-1",
    dealerDealershipId: "dealer-1",
    platformDealership: { displayName: "Acme", legalName: "Acme Motors" },
  });
  prismaMock.platformEmailLog.findFirst.mockResolvedValue(null);
  prismaMock.platformEmailLog.create.mockResolvedValue({});
  callDealerOwnerInviteMock.mockResolvedValue({
    ok: true,
    data: {
      inviteId: "invite-1",
      invitedEmail: "owner@example.com",
      createdAt: new Date().toISOString(),
      acceptUrl,
    },
  });
  sendOwnerInviteEmailMock.mockResolvedValue({ id: "resend-1" });
}

describe("Platform owner-invite RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when user is not PLATFORM_OWNER (guard before lookup)", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({
      userId: "user-1",
      role: "PLATFORM_SUPPORT",
    });
    requirePlatformRoleMock.mockRejectedValueOnce(
      new PlatformApiErrorClass("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/dealerships/platform-1/owner-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "platform-1" }) });
    expect(res.status).toBe(403);
    expect(prismaMock.dealershipMapping.findUnique).not.toHaveBeenCalled();
    expect(callDealerOwnerInviteMock).not.toHaveBeenCalled();
  });

  it("returns 201, sends email, writes audit with recipientHash only when PLATFORM_OWNER", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({
      userId: "owner-1",
      role: "PLATFORM_OWNER",
    });
    requirePlatformRoleMock.mockResolvedValue(undefined);
    setupSuccessMocks();
    const req = new Request("http://localhost/api/platform/dealerships/platform-1/owner-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "platform-1" }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.inviteId).toBe("invite-1");
    expect(json.dealerDealershipId).toBe("dealer-1");
    expect(json.alreadySentRecently).toBe(false);
    expect(sendOwnerInviteEmailMock).toHaveBeenCalledTimes(1);
    expect(platformAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.owner_invite.email_sent",
        targetType: "dealership",
        targetId: "platform-1",
        afterState: expect.objectContaining({
          recipientHash: "hash-owner@example.com",
          inviteId: "invite-1",
        }),
      })
    );
    expect(platformAuditLogMock.mock.calls[0][0].afterState).not.toHaveProperty("invitedEmail");
    expect(platformAuditLogMock.mock.calls[0][0].afterState).not.toHaveProperty("acceptUrl");
  });
});

describe("Platform owner-invite dedupe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips email and returns alreadySentRecently when same recipient within 5 min", async () => {
    requirePlatformAuthMock.mockResolvedValue({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValue(undefined);
    prismaMock.dealershipMapping.findUnique.mockResolvedValue({
      platformDealershipId: "platform-1",
      dealerDealershipId: "dealer-1",
      platformDealership: { displayName: "Acme", legalName: "Acme Motors" },
    });
    prismaMock.platformEmailLog.findFirst.mockResolvedValue({
      id: "log-1",
      platformDealershipId: "platform-1",
      type: "OWNER_INVITE",
      recipientHash: "hash-owner@example.com",
      sentAt: new Date(),
    });
    callDealerOwnerInviteMock.mockResolvedValue({
      ok: true,
      data: {
        inviteId: "invite-1",
        invitedEmail: "owner@example.com",
        createdAt: new Date().toISOString(),
        acceptUrl: "https://dealer.example.com/accept-invite?token=xyz",
      },
    });
    const req = new Request("http://localhost/api/platform/dealerships/platform-1/owner-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "platform-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.alreadySentRecently).toBe(true);
    expect(json.acceptUrl).toBe("https://dealer.example.com/accept-invite?token=xyz");
    expect(sendOwnerInviteEmailMock).not.toHaveBeenCalled();
    expect(prismaMock.platformEmailLog.create).not.toHaveBeenCalled();
    expect(platformAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.owner_invite.email_skipped_recent",
        afterState: expect.objectContaining({ recipientHash: "hash-owner@example.com" }),
      })
    );
  });
});

describe("Platform owner-invite email failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 502 and audits email_failed when Resend fails", async () => {
    requirePlatformAuthMock.mockResolvedValue({ userId: "owner-1", role: "PLATFORM_OWNER" });
    requirePlatformRoleMock.mockResolvedValue(undefined);
    setupSuccessMocks();
    sendOwnerInviteEmailMock.mockResolvedValueOnce({ error: new Error("Resend error") });
    const req = new Request("http://localhost/api/platform/dealerships/platform-1/owner-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "platform-1" }) });
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error?.code).toBe("EMAIL_FAILED");
    expect(platformAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.owner_invite.email_failed",
        afterState: expect.objectContaining({
          recipientHash: "hash-owner@example.com",
          emailFailed: true,
        }),
      })
    );
    expect(platformAuditLogMock.mock.calls[0][0].afterState).not.toHaveProperty("invitedEmail");
  });
});
