/**
 * Route tests for GET/PATCH/DELETE /api/customers/[id]:
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

jest.mock("@/modules/customers/service/customer", () => ({
  getCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  deleteCustomer: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET, PATCH, DELETE } from "./route";
import * as customerService from "@/modules/customers/service/customer";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["customers.read", "customers.write"],
};

const idValid = "c1000000-0000-0000-0000-000000000001";

describe("GET /api/customers/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (customerService.getCustomer as jest.Mock).mockResolvedValue({
      id: idValid,
      dealershipId: ctx.dealershipId,
      name: "Test",
      status: "LEAD",
      phones: [],
      emails: [],
    });
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const request = { nextUrl: new URL("http://localhost/api/customers/not-a-uuid"), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: "not-a-uuid" });
    const res = await GET(request, { params });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBeDefined();
    expect(customerService.getCustomer).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = { nextUrl: new URL("http://localhost/api/customers/" + idValid), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: idValid });
    const res = await GET(request, { params });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
  });
});

describe("PATCH /api/customers/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/customers/not-a-uuid"),
      headers: new Headers(),
      json: () => Promise.resolve({ name: "Updated" }),
    } as unknown as NextRequest;
    const params = Promise.resolve({ id: "not-a-uuid" });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(400);
    expect(customerService.updateCustomer).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = {
      nextUrl: new URL("http://localhost/api/customers/" + idValid),
      headers: new Headers(),
      json: () => Promise.resolve({ name: "Updated" }),
    } as unknown as NextRequest;
    const params = Promise.resolve({ id: idValid });
    const res = await PATCH(request, { params });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/customers/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (customerService.deleteCustomer as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 400 when id is not a valid UUID", async () => {
    const request = { nextUrl: new URL("http://localhost/api/customers/not-a-uuid"), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: "not-a-uuid" });
    const res = await DELETE(request, { params });
    expect(res.status).toBe(400);
    expect(customerService.deleteCustomer).not.toHaveBeenCalled();
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = { nextUrl: new URL("http://localhost/api/customers/" + idValid), headers: new Headers() } as unknown as NextRequest;
    const params = Promise.resolve({ id: idValid });
    const res = await DELETE(request, { params });
    expect(res.status).toBe(403);
  });
});
