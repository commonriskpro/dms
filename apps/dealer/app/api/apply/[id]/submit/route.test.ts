/** @jest-environment node */
/**
 * POST /api/apply/[id]/submit — submit application for review.
 * Tests: rate limit, 404, INVALID_STATE, success.
 */
jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  getClientIdentifier: jest.fn(() => "test-client"),
}));
jest.mock("@/modules/dealer-application/service/application", () => ({
  submitApplication: jest.fn(),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";

const appId = "a1000000-0000-0000-0000-000000000001";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function req(): NextRequest {
  return { headers: new Headers() } as unknown as NextRequest;
}

describe("POST /api/apply/[id]/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockReturnValue(true);
  });

  it("returns 429 when rate limited", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue(false);
    const res = await POST(req(), ctx(appId));
    expect(res.status).toBe(429);
    expect(dealerApplicationService.submitApplication).not.toHaveBeenCalled();
  });

  it("returns 404 when application not found", async () => {
    (dealerApplicationService.submitApplication as jest.Mock).mockRejectedValue(
      new ApiError("NOT_FOUND", "Application not found")
    );
    const res = await POST(req(), ctx(appId));
    expect(res.status).toBe(404);
  });

  it("returns 400 INVALID_STATE when already submitted", async () => {
    (dealerApplicationService.submitApplication as jest.Mock).mockRejectedValue(
      new ApiError("INVALID_STATE", "Application already submitted or not in draft state")
    );
    const res = await POST(req(), ctx(appId));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("INVALID_STATE");
  });

  it("returns 200 with status submitted and submittedAt", async () => {
    const submittedAt = new Date();
    (dealerApplicationService.submitApplication as jest.Mock).mockResolvedValue({
      id: appId,
      status: "submitted",
      submittedAt,
    });
    const res = await POST(req(), ctx(appId));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.applicationId).toBe(appId);
    expect(json.status).toBe("submitted");
    expect(json.submittedAt).toBeDefined();
    expect(dealerApplicationService.submitApplication).toHaveBeenCalledWith(
      appId,
      expect.any(Object)
    );
  });
});
