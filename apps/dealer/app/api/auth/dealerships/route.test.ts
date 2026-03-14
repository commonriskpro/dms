/** @jest-environment node */
jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor(public code: string, message: string) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

jest.mock("@/modules/core-platform/service/session", () => ({
  listUserDealerships: jest.fn(),
}));

import { requireUser } from "@/lib/auth";
import * as sessionService from "@/modules/core-platform/service/session";
import { GET } from "./route";

describe("GET /api/auth/dealerships", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireUser as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
    });
  });

  it("returns dealership options for the authenticated user", async () => {
    (sessionService.listUserDealerships as jest.Mock).mockResolvedValue([
      {
        dealershipId: "deal-1",
        dealershipName: "Dealer One",
        roleKey: "owner",
        roleName: "Owner",
        isActive: false,
      },
      {
        dealershipId: "deal-2",
        dealershipName: "Dealer Two",
        roleKey: "sales",
        roleName: "Sales",
        isActive: false,
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.dealerships).toEqual([
      { id: "deal-1", name: "Dealer One" },
      { id: "deal-2", name: "Dealer Two" },
    ]);
  });
});
