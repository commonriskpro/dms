/** @jest-environment node */
jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn(),
}));

jest.mock("@/lib/tenant", () => ({
  setActiveDealershipCookie: jest.fn(),
}));

jest.mock("@/lib/api/handler", () => ({
  handleApiError: jest.fn((error: Error) =>
    Response.json({ error: error.message }, { status: 500 })
  ),
  jsonResponse: jest.fn((data: unknown) => Response.json(data)),
}));

jest.mock("@/modules/core-platform/service/bootstrap", () => ({
  bootstrapLinkOwnerToDemoDealership: jest.fn(),
}));

import { POST } from "./route";
import { requireUser } from "@/lib/auth";
import { setActiveDealershipCookie } from "@/lib/tenant";
import { jsonResponse, handleApiError } from "@/lib/api/handler";
import * as bootstrapService from "@/modules/core-platform/service/bootstrap";

describe("POST /api/admin/bootstrap-link-owner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireUser as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "owner@example.com",
    });
  });

  it("delegates bootstrap linking to the service and sets the dealership cookie", async () => {
    (bootstrapService.bootstrapLinkOwnerToDemoDealership as jest.Mock).mockResolvedValue({
      message: "Linked as Owner",
      membershipId: "membership-1",
      dealershipId: "dealer-1",
    });

    const response = await POST(new Request("http://localhost/api/admin/bootstrap-link-owner") as never);

    expect(bootstrapService.bootstrapLinkOwnerToDemoDealership).toHaveBeenCalledWith({
      userId: "user-1",
      email: "owner@example.com",
      allowBootstrap: false,
    });
    expect(setActiveDealershipCookie).toHaveBeenCalledWith("dealer-1");
    expect(jsonResponse).toHaveBeenCalledWith({
      message: "Linked as Owner",
      membershipId: "membership-1",
      dealershipId: "dealer-1",
    });
    expect(response.status).toBe(200);
  });

  it("routes service failures through handleApiError", async () => {
    const error = new Error("boom");
    (bootstrapService.bootstrapLinkOwnerToDemoDealership as jest.Mock).mockRejectedValue(error);

    const response = await POST(new Request("http://localhost/api/admin/bootstrap-link-owner") as never);

    expect(handleApiError).toHaveBeenCalledWith(error);
    expect(response.status).toBe(500);
  });
});
