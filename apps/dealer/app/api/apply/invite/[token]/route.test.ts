/** @jest-environment node */
/**
 * GET /api/apply/invite/[token] — resolve invite token and return application (or create draft).
 * Tests: rate limit, INVITE_NOT_FOUND, INVITE_EXPIRED, INVITE_ALREADY_ACCEPTED, success with existing app, success with new draft.
 */
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "test-client"),
}));
jest.mock("@/modules/platform-admin/db/invite", () => ({
  getInviteByToken: jest.fn(),
}));
jest.mock("@/modules/dealer-application/service/application", () => ({
  getApplicationByInviteId: jest.fn(),
  createDraft: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";
import * as inviteDb from "@/modules/platform-admin/db/invite";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";

const token = "invite-token-abc";
const inviteId = "i1000000-0000-0000-0000-000000000001";
const appId = "a1000000-0000-0000-0000-000000000001";

function ctx(t: string) {
  return { params: Promise.resolve({ token: t }) };
}

function req(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

describe("GET /api/apply/invite/[token]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue(true);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue(false);
    const res = await GET(req(), ctx(token));
    expect(res.status).toBe(429);
    expect(inviteDb.getInviteByToken).not.toHaveBeenCalled();
  });

  it("returns 404 INVITE_NOT_FOUND when token does not match", async () => {
    (inviteDb.getInviteByToken as jest.Mock).mockResolvedValue(null);
    const res = await GET(req(), ctx(token));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error?.code).toBe("INVITE_NOT_FOUND");
    expect(JSON.stringify(json)).not.toContain(token);
  });

  it("returns 410 INVITE_ALREADY_ACCEPTED when invite status is ACCEPTED", async () => {
    (inviteDb.getInviteByToken as jest.Mock).mockResolvedValue({
      id: inviteId,
      email: "u@example.com",
      status: "ACCEPTED",
    });
    const res = await GET(req(), ctx(token));
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error?.code).toBe("INVITE_ALREADY_ACCEPTED");
  });

  it("returns 410 INVITE_EXPIRED when invite status is EXPIRED", async () => {
    (inviteDb.getInviteByToken as jest.Mock).mockResolvedValue({
      id: inviteId,
      email: "u@example.com",
      status: "EXPIRED",
    });
    const res = await GET(req(), ctx(token));
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.error?.code).toBe("INVITE_EXPIRED");
  });

  it("returns 200 with existing application when app exists for invite", async () => {
    (inviteDb.getInviteByToken as jest.Mock).mockResolvedValue({
      id: inviteId,
      email: "owner@example.com",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 86400000),
      createdBy: null,
    });
    (dealerApplicationService.getApplicationByInviteId as jest.Mock).mockResolvedValue({
      id: appId,
      status: "invited",
      source: "invite",
      ownerEmail: "owner@example.com",
      submittedAt: null,
      profile: { businessInfo: {}, ownerInfo: {}, primaryContact: {}, additionalLocations: [], pricingPackageInterest: {}, acknowledgments: {} },
    });
    const res = await GET(req(), ctx(token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.applicationId).toBe(appId);
    expect(json.status).toBe("invited");
    expect(json.inviteId).toBe(inviteId);
    expect(json.profile).toBeDefined();
    expect(dealerApplicationService.createDraft).not.toHaveBeenCalled();
  });

  it("returns 200 and creates draft when no application exists for invite", async () => {
    (inviteDb.getInviteByToken as jest.Mock).mockResolvedValue({
      id: inviteId,
      email: "new@example.com",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 86400000),
      createdBy: "user-uuid",
    });
    (dealerApplicationService.getApplicationByInviteId as jest.Mock).mockResolvedValue(null);
    (dealerApplicationService.createDraft as jest.Mock).mockResolvedValue({
      id: appId,
      status: "invited",
      source: "invite",
      ownerEmail: "new@example.com",
      profile: null,
    });
    const res = await GET(req(), ctx(token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.applicationId).toBe(appId);
    expect(json.status).toBe("invited");
    expect(json.inviteId).toBe(inviteId);
    expect(dealerApplicationService.createDraft).toHaveBeenCalledWith(
      {
        source: "invite",
        ownerEmail: "new@example.com",
        inviteId: inviteId,
        invitedByUserId: "user-uuid",
      },
      undefined
    );
  });
});
