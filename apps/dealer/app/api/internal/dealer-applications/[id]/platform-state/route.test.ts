/** @jest-environment node */
jest.mock("@/lib/internal-api-auth", () => ({
  verifyInternalApiJwt: jest.fn(),
  InternalApiError: class InternalApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number
    ) {
      super(message);
      this.name = "InternalApiError";
    }
  },
}));

jest.mock("@/lib/internal-rate-limit", () => ({
  checkInternalRateLimit: jest.fn(() => null),
}));

jest.mock("@/modules/dealer-application/service/application", () => ({
  internalUpdateApplication: jest.fn(),
}));

import { POST } from "./route";
import { verifyInternalApiJwt } from "@/lib/internal-api-auth";
import { internalUpdateApplication } from "@/modules/dealer-application/service/application";

const APP_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("POST /api/internal/dealer-applications/[id]/platform-state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
  });

  it("updates dealer compatibility state without re-syncing platform", async () => {
    (internalUpdateApplication as jest.Mock).mockResolvedValue({
      id: APP_ID,
      status: "approved",
      dealershipId: null,
      platformApplicationId: null,
      platformDealershipId: null,
      activationSentAt: null,
      activatedAt: null,
    });

    const res = await POST(
      new Request(`http://localhost/api/internal/dealer-applications/${APP_ID}/platform-state`, {
        method: "POST",
        headers: { Authorization: "Bearer test" },
        body: JSON.stringify({ status: "approved", reviewNotes: "Looks good" }),
      }) as never,
      { params: Promise.resolve({ id: APP_ID }) }
    );

    expect(res.status).toBe(200);
    expect(internalUpdateApplication).toHaveBeenCalledWith(
      APP_ID,
      { status: "approved", reviewNotes: "Looks good" },
      expect.objectContaining({ skipPlatformSync: true })
    );
  });
});
