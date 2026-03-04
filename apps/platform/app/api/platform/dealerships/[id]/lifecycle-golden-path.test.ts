/**
 * Golden path: platform lifecycle flow (provision → activate → suspend → close)
 * with mocked dealer. Asserts platform status transitions and audit entries.
 * Dealer enforcement (SUSPENDED blocks writes, CLOSED blocks read+write) is covered by lib/tenant-status.test.ts.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    platformDealership: { findUnique: jest.fn(), update: jest.fn() },
    dealershipMapping: { create: jest.fn() },
  },
}));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn() }));
jest.mock("@/lib/call-dealer-internal", () => ({
  callDealerProvision: jest.fn(),
  callDealerStatus: jest.fn(),
}));

import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { callDealerProvision, callDealerStatus } from "@/lib/call-dealer-internal";
import { POST as provisionPost } from "./provision/route";
import { POST as statusPost } from "./status/route";

const platformDealershipId = "pd-00000000-0000-0000-0000-000000000001";
const dealerDealershipId = "dd-00000000-0000-0000-0000-000000000002";

describe("Platform lifecycle golden path", () => {
  const owner = { userId: "owner-1", role: "PLATFORM_OWNER" };

  beforeEach(() => {
    jest.clearAllMocks();
    (requirePlatformAuth as jest.Mock).mockResolvedValue(owner);
    (requirePlatformRole as jest.Mock).mockResolvedValue(undefined);
    (platformAuditLog as jest.Mock).mockResolvedValue(undefined);
  });

  it("provision: dealer call failure returns 502 with requestId, idempotencyKey, upstreamStatus; audit with dealerCallFailed and no PII", async () => {
    (prisma.platformDealership.findUnique as jest.Mock).mockResolvedValue({
      id: platformDealershipId,
      status: "APPROVED",
      legalName: "Acme",
      displayName: "Acme",
      planKey: "starter",
      limits: {},
      mapping: null,
    });
    (prisma.platformDealership.update as jest.Mock).mockResolvedValue({});
    (callDealerProvision as jest.Mock).mockResolvedValue({
      ok: false,
      error: { status: 503, code: "SERVICE_UNAVAILABLE", message: "Dealer returned sensitive token: sk-xxx" },
      jti: "jti-provision-fail-1",
    });

    const req = new Request(`http://localhost/api/platform/dealerships/${platformDealershipId}/provision`, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "ik-fail-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await provisionPost(req, { params: Promise.resolve({ id: platformDealershipId }) });

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error?.code).toBe("DEALER_PROVISION_FAILED");
    expect(json.error?.details).toMatchObject({
      requestId: "jti-provision-fail-1",
      idempotencyKey: "ik-fail-1",
      upstreamStatus: 503,
    });
    expect(json.error?.details).not.toHaveProperty("message");
    expect(JSON.stringify(json)).not.toMatch(/sk-xxx|token|secret/i);
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.provision",
        afterState: expect.objectContaining({
          status: "PROVISIONING",
          dealerCallFailed: true,
          upstreamStatus: 503,
        }),
      })
    );
    const auditAfter = (platformAuditLog as jest.Mock).mock.calls[0][0].afterState as Record<string, unknown>;
    expect(auditAfter).not.toHaveProperty("dealerError");
    expect(JSON.stringify(auditAfter)).not.toMatch(/sk-xxx|token|secret|message/i);
  });

  it("provision: success writes audit with beforeState/afterState, requestId, idempotencyKey", async () => {
    (prisma.platformDealership.findUnique as jest.Mock).mockResolvedValue({
      id: platformDealershipId,
      status: "APPROVED",
      legalName: "Acme",
      displayName: "Acme",
      planKey: "starter",
      limits: {},
      mapping: null,
    });
    (prisma.platformDealership.update as jest.Mock).mockResolvedValue({});
    (prisma.dealershipMapping.create as jest.Mock).mockResolvedValue({});
    (callDealerProvision as jest.Mock).mockResolvedValue({
      ok: true,
      data: { dealerDealershipId, provisionedAt: new Date().toISOString() },
      jti: "jti-provision-1",
    });

    const req = new Request(`http://localhost/api/platform/dealerships/${platformDealershipId}/provision`, {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "ik-1" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await provisionPost(req, { params: Promise.resolve({ id: platformDealershipId }) });

    expect(res.status).toBe(200);
    expect(platformAuditLog).toHaveBeenCalledTimes(1);
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorPlatformUserId: owner.userId,
        action: "dealership.provision",
        targetType: "dealership",
        targetId: platformDealershipId,
        beforeState: { status: "APPROVED" },
        afterState: expect.objectContaining({ status: "PROVISIONED", dealerDealershipId, provisionedAt: expect.any(String) }),
        requestId: "jti-provision-1",
        idempotencyKey: "ik-1",
      })
    );
  });

  it("status ACTIVE: updates platform and writes audit with beforeState/afterState and requestId", async () => {
    (prisma.platformDealership.findUnique as jest.Mock).mockResolvedValue({
      id: platformDealershipId,
      status: "PROVISIONED",
      mapping: { dealerDealershipId },
    });
    (prisma.platformDealership.update as jest.Mock).mockResolvedValue({});
    (callDealerStatus as jest.Mock).mockResolvedValue({ ok: true });

    const req = new Request(`http://localhost/api/platform/dealerships/${platformDealershipId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "ACTIVE" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await statusPost(req, { params: Promise.resolve({ id: platformDealershipId }) });

    expect(res.status).toBe(200);
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorPlatformUserId: owner.userId,
        action: "dealership.status",
        targetType: "dealership",
        targetId: platformDealershipId,
        beforeState: { status: "PROVISIONED" },
        afterState: { status: "ACTIVE" },
        requestId: expect.stringMatching(/^status-/),
      })
    );
  });

  it("status SUSPENDED with reason: writes audit with reason", async () => {
    (prisma.platformDealership.findUnique as jest.Mock).mockResolvedValue({
      id: platformDealershipId,
      status: "ACTIVE",
      mapping: { dealerDealershipId },
    });
    (prisma.platformDealership.update as jest.Mock).mockResolvedValue({});
    (callDealerStatus as jest.Mock).mockResolvedValue({ ok: true });

    const req = new Request(`http://localhost/api/platform/dealerships/${platformDealershipId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "SUSPENDED", reason: "Policy violation" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await statusPost(req, { params: Promise.resolve({ id: platformDealershipId }) });

    expect(res.status).toBe(200);
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.status",
        afterState: { status: "SUSPENDED" },
        reason: "Policy violation",
      })
    );
  });

  it("status CLOSED with reason: writes audit with reason", async () => {
    (prisma.platformDealership.findUnique as jest.Mock).mockResolvedValue({
      id: platformDealershipId,
      status: "SUSPENDED",
      mapping: { dealerDealershipId },
    });
    (prisma.platformDealership.update as jest.Mock).mockResolvedValue({});
    (callDealerStatus as jest.Mock).mockResolvedValue({ ok: true });

    const req = new Request(`http://localhost/api/platform/dealerships/${platformDealershipId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "CLOSED", reason: "Contract ended" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await statusPost(req, { params: Promise.resolve({ id: platformDealershipId }) });

    expect(res.status).toBe(200);
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.status",
        afterState: { status: "CLOSED" },
        reason: "Contract ended",
      })
    );
  });

  it("status: dealer failure returns 502 with requestId and upstreamStatus; audit with dealerCallFailed and no PII", async () => {
    (prisma.platformDealership.findUnique as jest.Mock).mockResolvedValue({
      id: platformDealershipId,
      status: "ACTIVE",
      mapping: { dealerDealershipId },
    });
    (callDealerStatus as jest.Mock).mockResolvedValue({ ok: false, status: 502, message: "Upstream error with PII" });

    const req = new Request(`http://localhost/api/platform/dealerships/${platformDealershipId}/status`, {
      method: "POST",
      body: JSON.stringify({ status: "SUSPENDED", reason: "Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await statusPost(req, { params: Promise.resolve({ id: platformDealershipId }) });

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error?.code).toBe("DEALER_STATUS_FAILED");
    expect(json.error?.details).toMatchObject({ upstreamStatus: 502 });
    expect(json.error?.details?.requestId).toBeDefined();
    expect(typeof json.error?.details?.requestId).toBe("string");
    expect(json.error?.message).not.toMatch(/PII|internal|stack/i);
    expect(JSON.stringify(json)).not.toMatch(/PII|Upstream error/i);
    expect(platformAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dealership.status",
        afterState: expect.objectContaining({ status: "ACTIVE", dealerCallFailed: true }),
      })
    );
    const auditAfter = (platformAuditLog as jest.Mock).mock.calls[0][0].afterState as Record<string, unknown>;
    expect(auditAfter).not.toHaveProperty("message");
    expect(JSON.stringify(auditAfter)).not.toMatch(/PII|Upstream error/i);
  });
});
