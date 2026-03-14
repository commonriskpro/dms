/** @jest-environment node */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
  };
});

jest.mock("@/modules/core-platform/service/session", () => ({
  getCurrentUserContextSummary: jest.fn(),
}));

import { getAuthContext } from "@/lib/api/handler";
import * as sessionService from "@/modules/core-platform/service/session";
import { GET } from "./route";

function nextRequest(): import("next/server").NextRequest {
  return { headers: new Headers() } as unknown as import("next/server").NextRequest;
}

describe("GET /api/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      dealershipId: "deal-1",
      permissions: ["inventory.read"],
    });
  });

  it("returns current user, dealership, and permissions", async () => {
    (sessionService.getCurrentUserContextSummary as jest.Mock).mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
      dealership: { id: "deal-1", name: "Dealer One" },
      permissions: ["inventory.read"],
    });

    const res = await GET(nextRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      user: { id: "user-1", email: "user@example.com" },
      dealership: { id: "deal-1", name: "Dealer One" },
      permissions: ["inventory.read"],
    });
  });
});
