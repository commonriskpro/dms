/**
 * DELETE /api/inventory/[id]/cost-documents/[docId]:
 * - Requires inventory.write and documents.write.
 * - 404 when document does not belong to vehicle (vehicleId mismatch).
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
  getCostDocument: jest.fn(),
  deleteCostDocument: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { DELETE } from "./route";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.write", "documents.write"],
};

const vehicleId = "e1000000-0000-0000-0000-000000000001";
const docId = "d3000000-0000-0000-0000-000000000003";

const mockDoc = {
  id: docId,
  vehicleId,
  costEntryId: null,
  fileObjectId: "file-1",
  kind: "invoice",
  createdAt: new Date(),
  createdByUserId: ctx.userId,
};

describe("DELETE /api/inventory/[id]/cost-documents/[docId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (costLedger.getCostDocument as jest.Mock).mockResolvedValue(mockDoc);
    (costLedger.deleteCostDocument as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 403 when guardPermission throws", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId, docId }) });
    expect(res.status).toBe(403);
    expect(costLedger.deleteCostDocument).not.toHaveBeenCalled();
  });

  it("returns 404 when document belongs to different vehicle", async () => {
    (costLedger.getCostDocument as jest.Mock).mockResolvedValue({ ...mockDoc, vehicleId: "other-vehicle-id" });
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId, docId }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error?.message).toContain("not found");
    expect(costLedger.deleteCostDocument).not.toHaveBeenCalled();
  });

  it("returns 204 when document belongs to vehicle", async () => {
    const req = { headers: new Headers() } as unknown as NextRequest;
    const res = await DELETE(req, { params: Promise.resolve({ id: vehicleId, docId }) });
    expect(res.status).toBe(204);
    expect(costLedger.deleteCostDocument).toHaveBeenCalledWith(ctx.dealershipId, docId, ctx.userId, expect.anything());
  });
});
