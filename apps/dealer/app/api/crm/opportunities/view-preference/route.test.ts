/** @jest-environment node */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/crm-pipeline-automation/service/opportunities-view-preference", () => ({
  getOpportunitiesViewPreference: jest.fn(),
  setOpportunitiesViewPreference: jest.fn(),
  isValidOpportunitiesView: jest.fn((value: string) => value === "board" || value === "list"),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import {
  getOpportunitiesViewPreference,
  setOpportunitiesViewPreference,
} from "@/modules/crm-pipeline-automation/service/opportunities-view-preference";
import { GET, PATCH } from "./route";

describe("CRM opportunities view preference route", () => {
  const ctx = {
    userId: "user-1",
    email: "user@example.com",
    dealershipId: "dealership-1",
    permissions: ["crm.read"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (getOpportunitiesViewPreference as jest.Mock).mockResolvedValue("board");
  });

  it("returns the saved preference on GET", async () => {
    const response = await GET(new Request("http://localhost/api/crm/opportunities/view-preference") as never);
    expect(response.status).toBe(200);
    expect(getOpportunitiesViewPreference).toHaveBeenCalledWith({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
    });
    await expect(response.json()).resolves.toEqual({ data: { view: "board" } });
  });

  it("returns 403 when crm.read is denied", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );

    const response = await GET(new Request("http://localhost/api/crm/opportunities/view-preference") as never);
    expect(response.status).toBe(403);
  });

  it("saves a valid preference on PATCH", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/crm/opportunities/view-preference", {
        method: "PATCH",
        body: JSON.stringify({ view: "list" }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(setOpportunitiesViewPreference).toHaveBeenCalledWith({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
      view: "list",
    });
    await expect(response.json()).resolves.toEqual({ data: { ok: true, view: "list" } });
  });

  it("rejects invalid values on PATCH", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/crm/opportunities/view-preference", {
        method: "PATCH",
        body: JSON.stringify({ view: "cards" }),
      }) as never
    );

    expect(response.status).toBe(400);
    expect(setOpportunitiesViewPreference).not.toHaveBeenCalled();
  });
});
