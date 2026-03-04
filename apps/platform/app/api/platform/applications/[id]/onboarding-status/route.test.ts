/**
 * Platform GET onboarding-status: RBAC, 404, nextAction, cache, no token/email leakage.
 */
jest.mock("@/lib/platform-auth", () => {
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
  return {
    requirePlatformAuth: jest.fn(),
    requirePlatformRole: jest.fn(),
    PlatformApiError,
  };
});
jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerOwnerInviteStatus: jest.fn(),
}));
jest.mock("@/lib/onboarding-status-cache", () => ({
  getOwnerInviteStatusCached: jest.fn(),
  setOwnerInviteStatusCached: jest.fn(),
}));
jest.mock("@/lib/rate-limit", () => ({
  checkPlatformRateLimit: () => true,
  getPlatformClientIdentifier: () => "test-client",
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    application: { findUnique: jest.fn() },
    platformAuditLog: { findMany: jest.fn() },
  },
}));

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { callDealerOwnerInviteStatus } from "@/lib/call-dealer-internal";
import { getOwnerInviteStatusCached, setOwnerInviteStatusCached } from "@/lib/onboarding-status-cache";
import { prisma } from "@/lib/db";
import { GET } from "./route";

const APP_ID = "550e8400-e29b-41d4-a716-446655440000";
const PLATFORM_DEALERSHIP_ID = "660e8400-e29b-41d4-a716-446655440001";
const DEALER_DEALERSHIP_ID = "770e8400-e29b-41d4-a716-446655440002";

describe("GET /api/platform/applications/[id]/onboarding-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOwnerInviteStatusCached as jest.Mock).mockReturnValue(null);
  });

  it("returns 403 when non-platform-admin", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "u1", role: "OTHER" });
    (requirePlatformRole as jest.Mock).mockImplementationOnce(() => {
      throw new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403);
    });
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: APP_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when application missing", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.application.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: APP_ID }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error?.code).toBe("NOT_FOUND");
  });

  it("returns 422 when application id is not UUID", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(422);
  });

  it("approved + no dealershipId → nextAction PROVISION, no dealer call", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.application.findUnique as jest.Mock).mockResolvedValueOnce({
      id: APP_ID,
      status: "APPROVED",
      contactEmail: "owner@acme.com",
      dealershipId: null,
      dealership: null,
    });
    (prisma.platformAuditLog.findMany as jest.Mock).mockResolvedValueOnce([]);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: APP_ID }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.nextAction).toBe("PROVISION");
    expect(json.data.ownerInvite).toBeNull();
    expect(json.data.contactEmail).toBeUndefined();
    expect(json.data.token).toBeUndefined();
    expect(callDealerOwnerInviteStatus).not.toHaveBeenCalled();
  });

  it("mapping exists → calls dealer once then cache hit on second call", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);

    const provisionedAtDate = new Date("2025-03-01T12:00:00Z");
    const appWithMapping = () => ({
      id: APP_ID,
      status: "APPROVED",
      contactEmail: "owner@acme.com",
      dealershipId: PLATFORM_DEALERSHIP_ID,
      dealership: {
        status: "PROVISIONED",
        mapping: {
          dealerDealershipId: DEALER_DEALERSHIP_ID,
          provisionedAt: new Date(provisionedAtDate.getTime()),
        },
      },
    });
    (prisma.application.findUnique as jest.Mock)
      .mockResolvedValueOnce(appWithMapping())
      .mockResolvedValueOnce(appWithMapping());
    (prisma.platformAuditLog.findMany as jest.Mock).mockResolvedValue([]);

    (getOwnerInviteStatusCached as jest.Mock).mockReturnValue(null);
    (callDealerOwnerInviteStatus as jest.Mock).mockResolvedValueOnce({
      ok: true,
      data: { status: "PENDING", expiresAt: null, acceptedAt: null },
    });

    const req = new Request("http://localhost");
    const res1 = await GET(req, { params: Promise.resolve({ id: APP_ID }) });
    expect(res1.status).toBe(200);
    expect(callDealerOwnerInviteStatus).toHaveBeenCalledTimes(1);
    expect(setOwnerInviteStatusCached).toHaveBeenCalled();

    (getOwnerInviteStatusCached as jest.Mock).mockReturnValue({
      status: "PENDING",
      expiresAt: null,
      acceptedAt: null,
    });

    const res2 = await GET(req, { params: Promise.resolve({ id: APP_ID }) });
    expect(res2.status).toBe(200);
    expect(callDealerOwnerInviteStatus).toHaveBeenCalledTimes(1);
  });

  it("response never contains raw email or token fields", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.application.findUnique as jest.Mock).mockResolvedValueOnce({
      id: APP_ID,
      status: "APPROVED",
      contactEmail: "secret@example.com",
      dealershipId: null,
      dealership: null,
    });
    (prisma.platformAuditLog.findMany as jest.Mock).mockResolvedValue([]);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: APP_ID }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeDefined();
    expect(json.data.contactEmail).toBeUndefined();
    expect(json.data.token).toBeUndefined();
    expect(json.data.acceptUrl).toBeUndefined();
    expect(json.data.contactEmailHash).toBeDefined();
    expect(typeof json.data.contactEmailHash).toBe("string");
  });
});
