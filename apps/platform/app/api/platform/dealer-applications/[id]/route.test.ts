/** @jest-environment node */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
}));

jest.mock("@/lib/dealer-applications", () => {
  class DealerApplicationNotFoundError extends Error {
    constructor(public dealerApplicationId: string) {
      super("Dealer application not found");
      this.name = "DealerApplicationNotFoundError";
    }
  }
  return {
    DealerApplicationNotFoundError,
    getPlatformDealerApplication: jest.fn(),
    updatePlatformDealerApplicationReview: jest.fn(),
  };
});

import { GET, PATCH } from "./route";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import {
  DealerApplicationNotFoundError,
  getPlatformDealerApplication,
  updatePlatformDealerApplicationReview,
} from "@/lib/dealer-applications";

const APP_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("/api/platform/dealer-applications/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
  });

  it("GET returns 404 when canonical record is missing", async () => {
    (getPlatformDealerApplication as jest.Mock).mockResolvedValue(null);
    const res = await GET(new Request(`http://localhost/api/platform/dealer-applications/${APP_ID}`), {
      params: Promise.resolve({ id: APP_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("GET returns the platform canonical detail", async () => {
    (getPlatformDealerApplication as jest.Mock).mockResolvedValue({
      id: APP_ID,
      dealerApplicationId: APP_ID,
      source: "invite",
      status: "under_review",
      ownerEmail: "owner@example.com",
      dealerInviteId: null,
      invitedByUserId: null,
      dealerDealershipId: null,
      platformApplicationId: null,
      platformDealershipId: null,
      submittedAt: "2026-03-14T00:00:00.000Z",
      approvedAt: null,
      rejectedAt: null,
      activationSentAt: null,
      activatedAt: null,
      reviewerUserId: null,
      reviewNotes: null,
      rejectionReason: null,
      createdAt: "2026-03-14T00:00:00.000Z",
      updatedAt: "2026-03-14T00:00:00.000Z",
      profile: null,
    });

    const res = await GET(new Request(`http://localhost/api/platform/dealer-applications/${APP_ID}`), {
      params: Promise.resolve({ id: APP_ID }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(APP_ID);
  });

  it("PATCH applies reviewer fallback and returns updated detail", async () => {
    (updatePlatformDealerApplicationReview as jest.Mock).mockResolvedValue({
      id: APP_ID,
      dealerApplicationId: APP_ID,
      status: "approved",
      source: "public_apply",
      ownerEmail: "owner@example.com",
      dealerInviteId: null,
      invitedByUserId: null,
      dealerDealershipId: null,
      platformApplicationId: null,
      platformDealershipId: null,
      submittedAt: "2026-03-14T00:00:00.000Z",
      approvedAt: "2026-03-14T01:00:00.000Z",
      rejectedAt: null,
      activationSentAt: null,
      activatedAt: null,
      reviewerUserId: "u1",
      reviewNotes: "Looks good",
      rejectionReason: null,
      createdAt: "2026-03-14T00:00:00.000Z",
      updatedAt: "2026-03-14T01:00:00.000Z",
      profile: null,
    });

    const res = await PATCH(
      new Request(`http://localhost/api/platform/dealer-applications/${APP_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved", reviewNotes: "Looks good" }),
      }),
      { params: Promise.resolve({ id: APP_ID }) }
    );

    expect(res.status).toBe(200);
    expect(updatePlatformDealerApplicationReview).toHaveBeenCalledWith(
      APP_ID,
      { status: "approved", reviewNotes: "Looks good", reviewerUserId: "u1" },
      "u1"
    );
  });

  it("PATCH returns 404 when the canonical record is missing", async () => {
    (updatePlatformDealerApplicationReview as jest.Mock).mockRejectedValue(
      new DealerApplicationNotFoundError(APP_ID)
    );

    const res = await PATCH(
      new Request(`http://localhost/api/platform/dealer-applications/${APP_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      }),
      { params: Promise.resolve({ id: APP_ID }) }
    );

    expect(res.status).toBe(404);
  });
});
