/**
 * Platform dealership invites GET: 422 when not provisioned; 200 when dealer returns data.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    dealershipMapping: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerListInvites: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { callDealerListInvites } from "@/lib/call-dealer-internal";
import { GET } from "./route";

const PLATFORM_ID = "d0000000-0000-0000-0000-000000000001";

describe("Platform GET dealership invites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 422 when dealership is not provisioned", async () => {
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new Request(`http://localhost/api/platform/dealerships/${PLATFORM_ID}/invites`);
    const res = await GET(req, { params: Promise.resolve({ id: PLATFORM_ID }) });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error?.code).toBe("NOT_PROVISIONED");
    expect(callDealerListInvites).not.toHaveBeenCalled();
  });

  it("returns 200 with data when dealer returns list", async () => {
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValue({
      dealerDealershipId: "dealer-d-1",
    });
    (callDealerListInvites as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        data: [
          {
            id: "inv-1",
            emailMasked: "a***@example.com",
            roleName: "Owner",
            status: "PENDING",
            expiresAt: null,
            createdAt: "2025-01-01T00:00:00.000Z",
            acceptedAt: null,
          },
        ],
        meta: { total: 1, limit: 50, offset: 0 },
      },
    });

    const req = new Request(`http://localhost/api/platform/dealerships/${PLATFORM_ID}/invites`);
    const res = await GET(req, { params: Promise.resolve({ id: PLATFORM_ID }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].emailMasked).toBe("a***@example.com");
    expect(json.meta.total).toBe(1);
    expect(callDealerListInvites).toHaveBeenCalledWith(
      "dealer-d-1",
      expect.objectContaining({ limit: 50, offset: 0 })
    );
  });
});
