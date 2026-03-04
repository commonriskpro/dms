/**
 * Platform owner-invite: PLATFORM_OWNER only; non-owner gets 403 before lookup.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
  PlatformApiError: class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  },
}));

jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerOwnerInvite: jest.fn(),
}));

jest.mock("@/lib/email/resend", () => ({
  sendOwnerInviteEmail: jest.fn(),
}));

jest.mock("@/lib/hash", () => ({
  hashEmail: (email: string) => `hash-${email.toLowerCase().trim()}`,
}));

jest.mock("@/lib/audit", () => ({
  platformAuditLog: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    dealershipMapping: { findUnique: jest.fn() },
    platformEmailLog: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { callDealerOwnerInvite } from "@/lib/call-dealer-internal";
import { sendOwnerInviteEmail } from "@/lib/email/resend";
import { platformAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { POST } from "./route";

function setupSuccessMocks(acceptUrl = "https://dealer.example.com/accept-invite?token=abc") {
  (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValue({
    platformDealershipId: "platform-1",
    dealerDealershipId: "dealer-1",
    platformDealership: { displayName: "Acme", legalName: "Acme Motors" },
  });
  (prisma.platformEmailLog.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.platformEmailLog.create as jest.Mock).mockResolvedValue({});
  (callDealerOwnerInvite as jest.Mock).mockResolvedValue({
    ok: true,
    data: {
      inviteId: "invite-1",
      invitedEmail: "owner@example.com",
      createdAt: new Date().toISOString(),
      acceptUrl,
    },
  });
  (sendOwnerInviteEmail as jest.Mock).mockResolvedValue({ id: "resend-1" });
}

describe("Platform owner-invite RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 when user is not PLATFORM_OWNER (guard before lookup)", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({
      userId: "user-1",
      role: "PLATFORM_SUPPORT",
    });
    (requirePlatformRole as jest.Mock).mockRejectedValueOnce(
      new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403)
    );
    const req = new Request("http://localhost/api/platform/dealerships/platform-1/owner-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "platform-1" }) });
    expect(res.status).toBe(403);
    expect(prisma.dealershipMapping.findUnique).not.toHaveBeenCalled();
    expect(callDealerOwnerInvite).not.toHaveBeenCalled();
  });

  it("returns 201, sends email, writes audit with recipientHash only when PLATFORM_OWNER", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({
      userId: "owner-1",
      role: "PLATFORM_OWNER",
    });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
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
    expect(sendOwnerInviteEmail).toHaveBeenCalledTimes(1);
    expect(platformAuditLog).toHaveBeenCalledWith(
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
    expect((platformAuditLog as jest.Mock).mock.calls[0][0].afterState).not.toHaveProperty("invitedEmail");
    expect((platformAuditLog as jest.Mock).mock.calls[0][0].afterState).not.toHaveProperty("acceptUrl");
  });
});

describe("Platform owner-invite dedupe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips email and returns alreadySentRecently when same recipient within 5 min", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValue({
      platformDealershipId: "platform-1",
      dealerDealershipId: "dealer-1",
      platformDealership: { displayName: "Acme", legalName: "Acme Motors" },
    });
    (prisma.platformEmailLog.findFirst as jest.Mock).mockResolvedValue({
      id: "log-1",
      platformDealershipId: "platform-1",
      type: "OWNER_INVITE",
      recipientHash: "hash-owner@example.com",
      sentAt: new Date(),
    });
    (callDealerOwnerInvite as jest.Mock).mockResolvedValue({
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
    expect(sendOwnerInviteEmail).not.toHaveBeenCalled();
    expect(prisma.platformEmailLog.create).not.toHaveBeenCalled();
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.owner_invite.email_skipped_recent",
        afterState: expect.objectContaining({ recipientHash: "hash-owner@example.com" }),
      })
    );
  });
});

describe("Platform owner-invite email failure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 502 and audits email_failed when Resend fails", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    setupSuccessMocks();
    (sendOwnerInviteEmail as jest.Mock).mockResolvedValueOnce({ error: new Error("Resend error") });
    const req = new Request("http://localhost/api/platform/dealerships/platform-1/owner-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "platform-1" }) });
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error?.code).toBe("EMAIL_FAILED");
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.owner_invite.email_failed",
        afterState: expect.objectContaining({
          recipientHash: "hash-owner@example.com",
          emailFailed: true,
        }),
      })
    );
    expect((platformAuditLog as jest.Mock).mock.calls[0][0].afterState).not.toHaveProperty("invitedEmail");
  });
});
