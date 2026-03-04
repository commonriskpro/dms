/**
 * Tenant lifecycle (SUSPENDED/CLOSED) enforcement: write blocked when suspended returns 403 TENANT_SUSPENDED.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getAuthContextMock = vi.hoisted(() => vi.fn());
const guardPermissionMock = vi.hoisted(() => vi.fn());
const getRequestMetaMock = vi.hoisted(() => vi.fn());
const dealServiceMock = vi.hoisted(() => ({
  createDeal: vi.fn(),
  listDeals: vi.fn(),
}));

vi.mock("@/lib/api/handler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/handler")>();
  return {
    ...actual,
    getAuthContext: (...args: unknown[]) => getAuthContextMock(...args),
    guardPermission: (...args: unknown[]) => guardPermissionMock(...args),
    getRequestMeta: (...args: unknown[]) => getRequestMetaMock(...args),
  };
});

vi.mock("@/modules/deals/service/deal", () => dealServiceMock);

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
    vi.clearAllMocks();
    getAuthContextMock.mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
      dealershipId: "dealership-1",
      permissions: ["deals.write"],
    });
    guardPermissionMock.mockResolvedValue(undefined);
    getRequestMetaMock.mockReturnValue({});
  });

  it("returns 403 TENANT_SUSPENDED when service throws TENANT_SUSPENDED (write blocked when suspended)", async () => {
    dealServiceMock.createDeal.mockRejectedValue(
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
    dealServiceMock.createDeal.mockRejectedValue(
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
