/**
 * Dealer internal owner-invite: JWT required, idempotency returns same inviteId.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyInternalApiJwtMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/internal-api-auth", () => ({
  verifyInternalApiJwt: verifyInternalApiJwtMock,
  InternalApiError: class InternalApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 401
    ) {
      super(message);
      this.name = "InternalApiError";
    }
  },
}));

import { POST as ownerInvitePost } from "@/app/api/internal/dealerships/[dealerDealershipId]/owner-invite/route";

function nextRequest(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
) {
  const { method = "POST", headers = {}, body } = opts;
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

describe("Dealer internal owner-invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing JWT with 401", async () => {
    const { InternalApiError } = await import("@/lib/internal-api-auth");
    verifyInternalApiJwtMock.mockRejectedValueOnce(
      new InternalApiError("UNAUTHORIZED", "Missing or invalid Authorization", 401)
    );
    const dealerId = "d0000000-0000-0000-0000-000000000001";
    const req = nextRequest(`http://localhost/api/internal/dealerships/${dealerId}/owner-invite`, {
      headers: { "idempotency-key": "key-no-jwt" },
      body: {
        email: "owner@example.com",
        platformDealershipId: "a0000000-0000-0000-0000-000000000001",
        platformActorId: "u0000000-0000-0000-0000-000000000001",
      },
    });
    const res = await ownerInvitePost(req, {
      params: Promise.resolve({ dealerDealershipId: dealerId }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error?.code).toBe("UNAUTHORIZED");
  });

  it("rejects missing Idempotency-Key with 422", async () => {
    verifyInternalApiJwtMock.mockResolvedValue(undefined);
    const dealerId = "d0000000-0000-0000-0000-000000000001";
    const req = nextRequest(`http://localhost/api/internal/dealerships/${dealerId}/owner-invite`, {
      headers: { authorization: "Bearer some.jwt" },
      body: {
        email: "owner@example.com",
        platformDealershipId: "a0000000-0000-0000-0000-000000000001",
        platformActorId: "u0000000-0000-0000-0000-000000000001",
      },
    });
    const res = await ownerInvitePost(req, {
      params: Promise.resolve({ dealerDealershipId: dealerId }),
    });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
  });
});
