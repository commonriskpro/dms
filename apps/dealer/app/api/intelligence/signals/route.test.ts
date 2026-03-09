/** @jest-environment node */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>(
    "@/lib/api/handler"
  );
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardAnyPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/intelligence/service/signal-engine", () => ({
  listSignalsForDealership: jest.fn(),
}));

import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/auth";
import { getAuthContext, guardAnyPermission } from "@/lib/api/handler";
import { listSignalsForDealership } from "@/modules/intelligence/service/signal-engine";
import { GET } from "./route";

const ctx = {
  userId: "u1000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  dealershipId: "d1000000-0000-0000-0000-000000000001",
  permissions: ["inventory.read"],
};

describe("GET /api/intelligence/signals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardAnyPermission as jest.Mock).mockResolvedValue(undefined);
    (listSignalsForDealership as jest.Mock).mockResolvedValue({
      data: [],
      total: 0,
    });
  });

  it("returns 400 when query validation fails", async () => {
    const req = {
      nextUrl: new URL("http://localhost/api/intelligence/signals?limit=999"),
    } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(listSignalsForDealership).not.toHaveBeenCalled();
  });

  it("returns 403 when permission check fails", async () => {
    (guardAnyPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const req = {
      nextUrl: new URL("http://localhost/api/intelligence/signals?domain=deals"),
    } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(listSignalsForDealership).not.toHaveBeenCalled();
  });

  it("lists tenant-scoped signals for requested domain", async () => {
    (listSignalsForDealership as jest.Mock).mockResolvedValue({
      data: [{ id: "sig-1", domain: "inventory", severity: "warning" }],
      total: 1,
    });
    const req = {
      nextUrl: new URL("http://localhost/api/intelligence/signals?domain=inventory&limit=5&offset=0"),
    } as unknown as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(guardAnyPermission).toHaveBeenCalledWith(ctx, ["inventory.read"]);
    expect(listSignalsForDealership).toHaveBeenCalledWith(
      ctx.dealershipId,
      expect.objectContaining({
        domain: "inventory",
        limit: 5,
        offset: 0,
      })
    );
    const body = await res.json();
    expect(body.meta.total).toBe(1);
  });
});
