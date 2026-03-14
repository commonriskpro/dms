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

jest.mock("@/lib/dealer-applications", () => ({
  syncDealerApplicationFromDealer: jest.fn(),
}));

import { POST } from "./route";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { syncDealerApplicationFromDealer } from "@/lib/dealer-applications";

const PAYLOAD = {
  dealerApplicationId: "550e8400-e29b-41d4-a716-446655440000",
  source: "public_apply",
  status: "submitted",
  ownerEmail: "owner@example.com",
  createdAt: "2026-03-14T00:00:00.000Z",
  updatedAt: "2026-03-14T00:00:00.000Z",
  profile: null,
};

describe("POST /api/internal/dealer-applications/sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns auth errors from internal JWT verification", async () => {
    (verifyInternalApiJwt as jest.Mock).mockRejectedValue(
      new InternalApiError("UNAUTHORIZED", "Missing token", 401)
    );

    const res = await POST(
      new Request("http://localhost/api/internal/dealer-applications/sync", { method: "POST" }) as never
    );

    expect(res.status).toBe(401);
  });

  it("upserts the canonical platform dealer application", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    (syncDealerApplicationFromDealer as jest.Mock).mockResolvedValue({
      id: "660e8400-e29b-41d4-a716-446655440001",
      dealerApplicationId: PAYLOAD.dealerApplicationId,
      status: "submitted",
      updatedAt: PAYLOAD.updatedAt,
    });

    const res = await POST(
      new Request("http://localhost/api/internal/dealer-applications/sync", {
        method: "POST",
        headers: { Authorization: "Bearer test" },
        body: JSON.stringify(PAYLOAD),
      }) as never
    );

    expect(res.status).toBe(201);
    expect(syncDealerApplicationFromDealer).toHaveBeenCalledWith(PAYLOAD);
  });
});
