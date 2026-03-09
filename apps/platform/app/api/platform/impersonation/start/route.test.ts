/**
 * Impersonation start: PLATFORM_OWNER only; returns redirectUrl; audits; 404 when mapping missing.
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
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn() }));
jest.mock("@/lib/support-session-token", () => ({
  createSupportSessionToken: jest.fn().mockResolvedValue("jwt.token.here"),
}));

import { POST } from "./route";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";

describe("POST /api/platform/impersonation/start", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DEALER_INTERNAL_API_URL = "https://dealer.example.com";
  });

  it("returns 422 on invalid body", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    const req = new Request("http://localhost/api/platform/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("returns 404 when dealership not provisioned", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost/api/platform/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformDealershipId: "00000000-0000-0000-0000-000000000001" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(platformAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200 with redirectUrl and audits when mapping exists", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "owner-1", role: "PLATFORM_OWNER" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (prisma.dealershipMapping.findUnique as jest.Mock).mockResolvedValue({
      dealerDealershipId: "dealer-dealer-1",
    });
    const req = new Request("http://localhost/api/platform/impersonation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformDealershipId: "00000000-0000-0000-0000-000000000001" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.redirectUrl).toContain("https://dealer.example.com/api/support-session/consume");
    expect(json.redirectUrl).toContain("token=jwt.token.here");
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "impersonation.started",
        targetType: "platform_dealership",
        targetId: "00000000-0000-0000-0000-000000000001",
      })
    );
  });
});
