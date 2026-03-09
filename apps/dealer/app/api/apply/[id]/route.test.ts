/** @jest-environment node */
/**
 * GET /api/apply/[id] and PATCH /api/apply/[id] — load and update draft.
 * Tests: 404, rate limit, GET response shape, PATCH validation and INVALID_STATE.
 */
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "test-client"),
}));
jest.mock("@/modules/dealer-application/service/application", () => ({
  getApplication: jest.fn(),
  updateDraft: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET, PATCH } from "./route";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";

const appId = "a1000000-0000-0000-0000-000000000001";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function getReq(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

function patchReq(body: object): NextRequest {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("GET /api/apply/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue(true);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue(false);
    const res = await GET(getReq(), ctx(appId));
    expect(res.status).toBe(429);
    expect(dealerApplicationService.getApplication).not.toHaveBeenCalled();
  });

  it("returns 404 when application not found", async () => {
    (dealerApplicationService.getApplication as jest.Mock).mockRejectedValue(
      new ApiError("NOT_FOUND", "Application not found")
    );
    const res = await GET(getReq(), ctx(appId));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error?.code).toBe("NOT_FOUND");
  });

  it("returns 200 with application and profile (no reviewNotes/rejectionReason)", async () => {
    (dealerApplicationService.getApplication as jest.Mock).mockResolvedValue({
      id: appId,
      status: "draft",
      source: "public_apply",
      ownerEmail: "owner@example.com",
      submittedAt: null,
      profile: {
        businessInfo: { businessName: "Acme" },
        ownerInfo: {},
        primaryContact: {},
        additionalLocations: [],
        pricingPackageInterest: {},
        acknowledgments: {},
      },
    });
    const res = await GET(getReq(), ctx(appId));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.applicationId).toBe(appId);
    expect(json.status).toBe("draft");
    expect(json.profile?.businessInfo?.businessName).toBe("Acme");
    expect(json.reviewNotes).toBeUndefined();
    expect(json.rejectionReason).toBeUndefined();
  });

  it("returns 422 for invalid UUID (params validation)", async () => {
    const res = await GET(getReq(), ctx("not-a-uuid"));
    expect(res.status).toBe(422);
  });
});

describe("PATCH /api/apply/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue(true);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue(false);
    const res = await PATCH(patchReq({}), ctx(appId));
    expect(res.status).toBe(429);
    expect(dealerApplicationService.updateDraft).not.toHaveBeenCalled();
  });

  it("returns 404 when application not found", async () => {
    (dealerApplicationService.updateDraft as jest.Mock).mockRejectedValue(
      new ApiError("NOT_FOUND", "Application not found")
    );
    const res = await PATCH(patchReq({ businessInfo: { businessName: "Acme" } }), ctx(appId));
    expect(res.status).toBe(404);
  });

  it("returns 400 INVALID_STATE when application not in draft/invited", async () => {
    (dealerApplicationService.updateDraft as jest.Mock).mockRejectedValue(
      new ApiError("INVALID_STATE", "Application can no longer be edited")
    );
    const res = await PATCH(patchReq({ businessInfo: {} }), ctx(appId));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("INVALID_STATE");
  });

  it("returns 200 with updated profile when draft", async () => {
    (dealerApplicationService.updateDraft as jest.Mock).mockResolvedValue({
      id: appId,
      status: "draft",
      profile: {
        businessInfo: { businessName: "Updated" },
        ownerInfo: {},
        primaryContact: {},
        additionalLocations: [],
        pricingPackageInterest: {},
        acknowledgments: {},
      },
    });
    const res = await PATCH(
      patchReq({ businessInfo: { businessName: "Updated" } }),
      ctx(appId)
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.applicationId).toBe(appId);
    expect(json.profile?.businessInfo?.businessName).toBe("Updated");
    expect(dealerApplicationService.updateDraft).toHaveBeenCalledWith(
      appId,
      { businessInfo: { businessName: "Updated" } },
      expect.any(Object)
    );
  });
});
