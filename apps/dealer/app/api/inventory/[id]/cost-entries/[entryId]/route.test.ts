/**
 * PATCH/DELETE /api/inventory/[id]/cost-entries/[entryId]:
 * - Both require inventory.write.
 * - 404 when entry does not belong to vehicle (vehicleId mismatch).
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
    getRequestMeta: jest.fn(() => ({})),
  };
});

jest.mock("@/modules/inventory/service/cost-ledger", () => ({
  getCostEntry: jest.fn(),
  updateCostEntry: jest.fn(),
  deleteCostEntry: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { PATCH, DELETE } from "./route";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.write"],
};

const vehicleId = "e1000000-0000-0000-0000-000000000001";
const entryId = "c2000000-0000-0000-0000-000000000002";

const mockEntry = {
  id: entryId,
  vehicleId,
  category: "acquisition",
  amountCents: BigInt(1000000),
  vendorName: "Auction Co",
  occurredAt: new Date(),
  memo: null,
  createdByUserId: ctx.userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PATCH /api/inventory/[id]/cost-entries/[entryId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (costLedger.getCostEntry as jest.Mock).mockResolvedValue(mockEntry);
    (costLedger.updateCostEntry as jest.Mock).mockResolvedValue({ ...mockEntry, memo: "Updated" });
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = {
      json: () => Promise.resolve({ memo: "Updated" }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await PATCH(req, { params: Promise.resolve({ id: vehicleId, entryId }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when entry belongs to different vehicle", async () => {
    (costLedger.getCostEntry as jest.Mock).mockResolvedValue({ ...mockEntry, vehicleId: "other-vehicle-id" });
    const req = {
      json: () => Promise.resolve({ memo: "Updated" }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await PATCH(req, { params: Promise.resolve({ id: vehicleId, entryId }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error?.message).toContain("not found");
    expect(costLedger.updateCostEntry).not.toHaveBeenCalled();
  });

  it("returns 200 with updated entry when vehicleId matches", async () => {
    const req = {
      json: () => Promise.resolve({ memo: "Updated" }),
      headers: new Headers(),
    } as unknown as NextRequest;
    const res = await PATCH(req, { params: Promise.resolve({ id: vehicleId, entryId }) });
    expect(res.status).toBe(200);
    expect(costLedger.updateCostEntry).toHaveBeenCalledWith(ctx.dealershipId, entryId, expect.any(Object), expect.anything());
  });
});

describe("DELETE /api/inventory/[id]/cost-entries/[entryId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (costLedger.getCostEntry as jest.Mock).mockResolvedValue(mockEntry);
    (costLedger.deleteCostEntry as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId, entryId }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when entry belongs to different vehicle", async () => {
    (costLedger.getCostEntry as jest.Mock).mockResolvedValue({ ...mockEntry, vehicleId: "other-vehicle-id" });
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId, entryId }) });
    expect(res.status).toBe(404);
    expect(costLedger.deleteCostEntry).not.toHaveBeenCalled();
  });

  it("returns 204 when entry belongs to vehicle", async () => {
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId, entryId }) });
    expect(res.status).toBe(204);
    expect(costLedger.deleteCostEntry).toHaveBeenCalledWith(ctx.dealershipId, entryId, ctx.userId, expect.anything());
  });
});
