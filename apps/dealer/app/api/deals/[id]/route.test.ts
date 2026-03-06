/**
 * Route tests for GET/PATCH/DELETE /api/deals/[id]:
 * - Invalid UUID id returns 400.
 * - RBAC denial (guardPermission throws) returns 403.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/deals/service/deal", () => ({
  getDeal: jest.fn(),
  updateDeal: jest.fn(),
  deleteDeal: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET, PATCH, DELETE } from "./route";
import * as dealService from "@/modules/deals/service/deal";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["deals.read", "deals.write"],
};

const idValid = "d1000000-0000-0000-0000-000000000001";

describe("GET /api/deals/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (dealService.getDeal as jest.Mock).mockResolvedValue({
      id: idValid,
      dealershipId: ctx.dealershipId,
      status: "DRAFT",
    });
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const request = { nextUrl: new URL("http://localhost/api/deals/not-a-uuid"), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: "not-a-uuid" });
    const res = await GET(request, { params });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBeDefined();
    expect(dealService.getDeal).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = { nextUrl: new URL("http://localhost/api/deals/" + idValid), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: idValid });
    const res = await GET(request, { params });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
  });
});

describe("PATCH /api/deals/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/deals/not-a-uuid"),
      headers: new Headers(),
      json: () => Promise.resolve({ notes: "Updated" }),
    } as unknown as NextRequest;
    const params = Promise.resolve({ id: "not-a-uuid" });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(400);
    expect(dealService.updateDeal).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = {
      nextUrl: new URL("http://localhost/api/deals/" + idValid),
      headers: new Headers(),
      json: () => Promise.resolve({ notes: "Updated" }),
    } as unknown as NextRequest;
    const params = Promise.resolve({ id: idValid });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/deals/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (dealService.deleteDeal as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const request = { nextUrl: new URL("http://localhost/api/deals/not-a-uuid"), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: "not-a-uuid" });
    const res = await DELETE(request, { params });
    expect(res.status).toBe(400);
    expect(dealService.deleteDeal).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = { nextUrl: new URL("http://localhost/api/deals/" + idValid), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: idValid });
    const res = await DELETE(request, { params });
    expect(res.status).toBe(403);
  });
});
