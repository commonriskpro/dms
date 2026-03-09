/** @jest-environment node */
/**
 * POST /api/apply/draft — create draft application (public or invite flow).
 * Tests: validation, rate limit, success response shape.
 */
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "test-client"),
}));
jest.mock("@/modules/dealer-application/service/application", () => ({
  createDraft: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { checkRateLimit } from "@/lib/api/rate-limit";

function req(body: object): NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("POST /api/apply/draft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue(true);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue(false);
    const res = await POST(req({ source: "public_apply", ownerEmail: "owner@example.com" }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error?.code).toBe("RATE_LIMITED");
    expect(dealerApplicationService.createDraft).not.toHaveBeenCalled();
  });

  it("returns 400 when source is missing", async () => {
    const res = await POST(req({ ownerEmail: "owner@example.com" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
    expect(dealerApplicationService.createDraft).not.toHaveBeenCalled();
  });

  it("returns 400 when ownerEmail is invalid", async () => {
    const res = await POST(req({ source: "public_apply", ownerEmail: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(dealerApplicationService.createDraft).not.toHaveBeenCalled();
  });

  it("returns 201 with applicationId and profile when valid public_apply", async () => {
    (dealerApplicationService.createDraft as jest.Mock).mockResolvedValue({
      id: "app-uuid-1",
      status: "draft",
      source: "public_apply",
      ownerEmail: "owner@example.com",
      profile: {
        businessInfo: {},
        ownerInfo: {},
        primaryContact: {},
        additionalLocations: [],
        pricingPackageInterest: {},
        acknowledgments: {},
      },
    });
    const res = await POST(req({ source: "public_apply", ownerEmail: "owner@example.com" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.applicationId).toBe("app-uuid-1");
    expect(json.status).toBe("draft");
    expect(json.source).toBe("public_apply");
    expect(json.ownerEmail).toBe("owner@example.com");
    expect(json.profile).toBeDefined();
    expect(json.profile.businessInfo).toEqual({});
    expect(dealerApplicationService.createDraft).toHaveBeenCalledWith(
      { source: "public_apply", ownerEmail: "owner@example.com", inviteId: undefined, invitedByUserId: undefined },
      expect.any(Object)
    );
  });

  it("accepts inviteId and invitedByUserId for invite flow", async () => {
    (dealerApplicationService.createDraft as jest.Mock).mockResolvedValue({
      id: "app-uuid-2",
      status: "invited",
      source: "invite",
      ownerEmail: "invited@example.com",
      profile: null,
    });
    const res = await POST(
      req({
        source: "invite",
        ownerEmail: "invited@example.com",
        inviteId: "a1000000-0000-0000-0000-000000000001",
        invitedByUserId: "b1000000-0000-0000-0000-000000000001",
      })
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.applicationId).toBe("app-uuid-2");
    expect(json.status).toBe("invited");
    expect(dealerApplicationService.createDraft).toHaveBeenCalledWith(
      {
        source: "invite",
        ownerEmail: "invited@example.com",
        inviteId: "a1000000-0000-0000-0000-000000000001",
        invitedByUserId: "b1000000-0000-0000-0000-000000000001",
      },
      expect.any(Object)
    );
  });
});
