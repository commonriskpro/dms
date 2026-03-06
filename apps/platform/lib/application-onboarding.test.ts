/**
 * Unit tests for application-onboarding: provision creates mapping with stable idempotency,
 * invite-owner calls dealer internal with stable idempotency key.
 */
jest.mock("@/lib/db", () => ({
  prisma: {
    application: { findUnique: jest.fn(), update: jest.fn() },
    platformDealership: { create: jest.fn(), update: jest.fn() },
    dealershipMapping: { create: jest.fn() },
    platformEmailLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock("@/lib/audit", () => ({
  platformAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerProvision: jest.fn(),
  callDealerOwnerInvite: jest.fn(),
  callDealerOwnerInviteStatus: jest.fn(),
}));

jest.mock("@/lib/email/resend", () => ({
  sendOwnerInviteEmail: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/lib/hash", () => ({
  hashEmail: jest.fn((email: string) => `hash-${email.toLowerCase()}`),
}));

const prisma = jest.requireMock("@/lib/db").prisma as {
  application: { findUnique: jest.Mock; update: jest.Mock };
  platformDealership: { create: jest.Mock; update: jest.Mock };
  dealershipMapping: { create: jest.Mock };
  platformEmailLog: { create: jest.Mock };
};
const callDealerProvision = jest.requireMock("@/lib/call-dealer-internal")
  .callDealerProvision as jest.Mock;
const callDealerOwnerInvite = jest.requireMock("@/lib/call-dealer-internal")
  .callDealerOwnerInvite as jest.Mock;

import {
  provisionDealershipFromApplication,
  inviteOwnerForApplication,
  ApplicationNotFoundError,
  InvalidStateError,
} from "@/lib/application-onboarding";

describe("application-onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("provisionDealershipFromApplication", () => {
    const applicationId = "app-111";
    const actorUserId = "user-1";
    const platformDealershipId = "plat-dd-111";
    const dealerDealershipId = "dealer-dd-222";
    const provisionedAt = "2025-01-15T12:00:00.000Z";

    it("uses stable idempotency key and creates mapping when dealer provision succeeds", async () => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue({
        id: applicationId,
        status: "APPROVED",
        legalName: "Acme",
        displayName: "Acme Corp",
        contactEmail: "owner@acme.com",
        dealershipId: null,
        dealership: null,
      });
      (prisma.platformDealership.create as jest.Mock).mockResolvedValue({
        id: platformDealershipId,
        legalName: "Acme",
        displayName: "Acme Corp",
        planKey: "standard",
        limits: {},
      });
      (prisma.platformDealership.update as jest.Mock).mockResolvedValue({});
      callDealerProvision.mockResolvedValue({
        ok: true,
        data: { dealerDealershipId, provisionedAt },
        jti: "jti-1",
      });
      (prisma.dealershipMapping.create as jest.Mock).mockResolvedValue({});

      const result = await provisionDealershipFromApplication(applicationId, actorUserId);

      expect(result.dealershipId).toBe(platformDealershipId);
      expect(result.status).toBe("PROVISIONED");
      expect(result.dealerDealershipId).toBe(dealerDealershipId);
      const idempotencyKey = callDealerProvision.mock.calls[0][5];
      expect(idempotencyKey).toBe(`app-provision-${applicationId}`);
      expect(prisma.dealershipMapping.create).toHaveBeenCalledWith({
        data: {
          platformDealershipId,
          dealerDealershipId,
          provisionedAt: new Date(provisionedAt),
        },
      });
    });

    it("returns existing dealership when application already has dealershipId", async () => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue({
        id: applicationId,
        status: "APPROVED",
        dealershipId: platformDealershipId,
        dealership: {
          id: platformDealershipId,
          displayName: "Acme",
          status: "PROVISIONED",
          mapping: { dealerDealershipId, provisionedAt: new Date(provisionedAt) },
        },
      });

      const result = await provisionDealershipFromApplication(applicationId, actorUserId);

      expect(result.dealershipId).toBe(platformDealershipId);
      expect(callDealerProvision).not.toHaveBeenCalled();
      expect(prisma.dealershipMapping.create).not.toHaveBeenCalled();
    });

    it("throws ApplicationNotFoundError when application not found", async () => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(provisionDealershipFromApplication(applicationId, actorUserId)).rejects.toThrow(
        ApplicationNotFoundError
      );
    });

    it("throws InvalidStateError when application not APPROVED", async () => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue({
        id: applicationId,
        status: "UNDER_REVIEW",
        dealershipId: null,
        dealership: null,
      });

      await expect(provisionDealershipFromApplication(applicationId, actorUserId)).rejects.toThrow(
        InvalidStateError
      );
    });
  });

  describe("inviteOwnerForApplication", () => {
    const applicationId = "app-222";
    const actorUserId = "user-2";
    const platformDealershipId = "plat-dd-333";
    const dealerDealershipId = "dealer-dd-444";
    const contactEmail = "owner@dealer.com";

    it("calls dealer owner-invite with stable idempotency key when mapping exists", async () => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue({
        id: applicationId,
        status: "APPROVED",
        contactEmail,
        dealershipId: platformDealershipId,
        dealership: {
          displayName: "Dealer Inc",
          mapping: { dealerDealershipId },
        },
      });
      callDealerOwnerInvite.mockResolvedValue({
        ok: true,
        data: {
          inviteId: "inv-1",
          invitedEmail: contactEmail,
          createdAt: "2025-01-15T12:00:00.000Z",
          acceptUrl: "https://dealer.example.com/accept-invite?token=xxx",
        },
      });

      const result = await inviteOwnerForApplication(applicationId, actorUserId);

      expect(result.inviteId).toBe("inv-1");
      expect(result.status).toBe("PENDING");
      const [dealerId, email, platId, platActorId, idempotencyKey] =
        callDealerOwnerInvite.mock.calls[0];
      expect(dealerId).toBe(dealerDealershipId);
      expect(email).toBe(contactEmail);
      expect(platId).toBe(platformDealershipId);
      expect(platActorId).toBe(actorUserId);
      expect(idempotencyKey).toBe(`app-invite-owner-${applicationId}-hash-${contactEmail.toLowerCase()}`);
    });
  });
});
