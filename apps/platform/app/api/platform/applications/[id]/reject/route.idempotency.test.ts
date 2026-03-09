/**
 * Application reject: idempotent when status is already REJECTED.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    application: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn().mockResolvedValue(undefined) }));

import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { POST } from "./route";

const APP_ID = "a0000000-0000-0000-0000-000000000001";

describe("Application reject idempotency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 200 with same id/status when application is already REJECTED (no update, no audit)", async () => {
    (prisma.application.findUnique as jest.Mock).mockResolvedValue({
      id: APP_ID,
      status: "REJECTED",
    });

    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Duplicate" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: APP_ID }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(APP_ID);
    expect(json.status).toBe("REJECTED");
    expect(prisma.application.update).not.toHaveBeenCalled();
    const { platformAuditLog } = await import("@/lib/audit");
    expect(platformAuditLog).not.toHaveBeenCalled();
  });

  it("updates and audits when status is APPLIED", async () => {
    (prisma.application.findUnique as jest.Mock).mockResolvedValue({
      id: APP_ID,
      status: "APPLIED",
    });
    (prisma.application.update as jest.Mock).mockResolvedValue({
      id: APP_ID,
      status: "REJECTED",
    });

    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Not qualified" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: APP_ID }) });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("REJECTED");
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: APP_ID },
      data: {
        status: "REJECTED",
        rejectionReason: "Not qualified",
        updatedAt: expect.any(Date),
      },
    });
    const { platformAuditLog } = await import("@/lib/audit");
    expect(platformAuditLog).toHaveBeenCalled();
  });
});
