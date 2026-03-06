/**
 * Tenant lifecycle (SUSPENDED/CLOSED) enforcement: write blocked when suspended returns 403 TENANT_SUSPENDED.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn(),
    getRequestMeta: jest.fn(),
  };
});

jest.mock("@/modules/deals/service/deal", () => ({
  createDeal: jest.fn(),
  listDeals: jest.fn(),
}));

import { getAuthContext, guardPermission, getRequestMeta } from "@/lib/api/handler";
import * as dealService from "@/modules/deals/service/deal";
import { POST } from "./route";
import { ApiError } from "@/lib/auth";

function nextRequest(body: object): import("next/server").NextRequest {
  return {
    url: "http://localhost/api/deals",
    json: () => Promise.resolve(body),
    headers: new Headers(),
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/deals tenant status", () => {
  const validBody = {
    customerId: "11111111-1111-1111-1111-111111111111",
    vehicleId: "22222222-2222-2222-2222-222222222222",
    salePriceCents: 10000,
    purchasePriceCents: 8000,
    taxRateBps: 800,
    docFeeCents: 500,
    downPaymentCents: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      dealershipId: "dealership-1",
      permissions: ["deals.write"],
    });
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (getRequestMeta as jest.Mock).mockReturnValue({});
  });

  it("returns 403 TENANT_SUSPENDED when service throws TENANT_SUSPENDED (write blocked when suspended)", async () => {
    (dealService.createDeal as jest.Mock).mockRejectedValue(
      new ApiError("TENANT_SUSPENDED", "This dealership is suspended; writes are not allowed")
    );

    const req = nextRequest(validBody);
    const res = await POST(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("TENANT_SUSPENDED");
    expect(data.error?.message).toMatch(/suspended/i);
  });

  it("returns 403 TENANT_CLOSED when service throws TENANT_CLOSED", async () => {
    (dealService.createDeal as jest.Mock).mockRejectedValue(
      new ApiError("TENANT_CLOSED", "This dealership is closed")
    );

    const req = nextRequest(validBody);
    const res = await POST(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("TENANT_CLOSED");
    expect(data.error?.message).toMatch(/closed/i);
  });
});
