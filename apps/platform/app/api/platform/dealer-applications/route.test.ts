/** @jest-environment node */
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

jest.mock("@/lib/dealer-applications", () => ({
  listPlatformDealerApplications: jest.fn(),
}));

import { GET } from "./route";
import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { listPlatformDealerApplications } from "@/lib/dealer-applications";

describe("GET /api/platform/dealer-applications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 for unauthorized platform roles", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1", role: "OTHER" });
    (requirePlatformRole as jest.Mock).mockImplementation(() => {
      throw new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403);
    });

    const res = await GET(new Request("http://localhost/api/platform/dealer-applications"));
    expect(res.status).toBe(403);
  });

  it("returns canonical platform dealer applications", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "u1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (listPlatformDealerApplications as jest.Mock).mockResolvedValue({
      data: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          dealerApplicationId: "550e8400-e29b-41d4-a716-446655440000",
          source: "public_apply",
          status: "submitted",
          ownerEmail: "owner@example.com",
          submittedAt: "2026-03-14T00:00:00.000Z",
          approvedAt: null,
          rejectedAt: null,
          activationSentAt: null,
          activatedAt: null,
          dealerDealershipId: null,
          platformApplicationId: null,
          platformDealershipId: null,
          createdAt: "2026-03-14T00:00:00.000Z",
          updatedAt: "2026-03-14T00:00:00.000Z",
        },
      ],
      meta: { total: 1, limit: 25, offset: 0 },
    });

    const res = await GET(
      new Request("http://localhost/api/platform/dealer-applications?status=submitted&source=public_apply")
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta.total).toBe(1);
    expect(listPlatformDealerApplications).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      status: "submitted",
      source: "public_apply",
    });
  });
});
