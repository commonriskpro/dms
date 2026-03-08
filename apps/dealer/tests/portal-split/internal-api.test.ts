/** @jest-environment node */
/**
 * Step 2: Dealer internal API — JWT rejection, idempotency, 409, status + audit.
 */
jest.mock("@/lib/internal-api-auth", () => ({
  verifyInternalApiJwt: jest.fn(),
  InternalApiError: class InternalApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 401
    ) {
      super(message);
      this.name = "InternalApiError";
    }
  },
}));

import { verifyInternalApiJwt } from "@/lib/internal-api-auth";
import { POST as provisionPost } from "@/app/api/internal/provision/dealership/route";
import { POST as statusPost } from "@/app/api/internal/dealerships/[dealerDealershipId]/status/route";
import { prisma } from "@/lib/db";

function nextRequest(url: string, opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
  const { method = "POST", headers = {}, body } = opts;
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

describe("Dealer internal API", () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects missing JWT with 401", async () => {
    const { InternalApiError } = await import("@/lib/internal-api-auth");
    (verifyInternalApiJwt as jest.Mock).mockRejectedValueOnce(
      new InternalApiError("UNAUTHORIZED", "Missing or invalid Authorization", 401)
    );
    const req = nextRequest("http://localhost/api/internal/provision/dealership", {
      headers: { "idempotency-key": "key-missing-auth" },
      body: {
        platformDealershipId: "a0000000-0000-0000-0000-000000000001",
        legalName: "Acme Inc",
        displayName: "Acme",
        planKey: "starter",
      },
    });
    const res = await provisionPost(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error?.code).toBe("UNAUTHORIZED");
  });

  it("rejects invalid JWT with 401", async () => {
    const { InternalApiError } = await import("@/lib/internal-api-auth");
    (verifyInternalApiJwt as jest.Mock).mockRejectedValueOnce(
      new InternalApiError("UNAUTHORIZED", "Invalid or expired token", 401)
    );
    const req = nextRequest("http://localhost/api/internal/provision/dealership", {
      headers: {
        "idempotency-key": "key-invalid-jwt",
        authorization: "Bearer invalid.jwt.here",
      },
      body: {
        platformDealershipId: "a0000000-0000-0000-0000-000000000002",
        legalName: "Acme Inc",
        displayName: "Acme",
        planKey: "starter",
      },
    });
    const res = await provisionPost(req);
    expect(res.status).toBe(401);
  });

  it("provision idempotency: same Idempotency-Key returns same dealerDealershipId", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    const platformId = crypto.randomUUID();
    const idempotencyKey = `idem-${platformId}`;
    const body = {
      platformDealershipId: platformId,
      legalName: "Idempotent Corp",
      displayName: "Idempotent",
      planKey: "starter",
    };
    const req1 = nextRequest("http://localhost/api/internal/provision/dealership", {
      headers: { "idempotency-key": idempotencyKey },
      body,
    });
    const res1 = await provisionPost(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    expect(data1.dealerDealershipId).toBeDefined();
    expect(data1.provisionedAt).toBeDefined();

    const req2 = nextRequest("http://localhost/api/internal/provision/dealership", {
      headers: { "idempotency-key": idempotencyKey },
      body,
    });
    const res2 = await provisionPost(req2);
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.dealerDealershipId).toBe(data1.dealerDealershipId);
    expect(data2.provisionedAt).toBe(data1.provisionedAt);
  });

  it("same platformDealershipId with different Idempotency-Key returns 409", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    const platformId = crypto.randomUUID();
    const body = {
      platformDealershipId: platformId,
      legalName: "Conflict Corp",
      displayName: "Conflict",
      planKey: "starter",
    };
    const req1 = nextRequest("http://localhost/api/internal/provision/dealership", {
      headers: { "idempotency-key": `key-first-${platformId}` },
      body,
    });
    const res1 = await provisionPost(req1);
    expect(res1.status).toBe(201);

    const req2 = nextRequest("http://localhost/api/internal/provision/dealership", {
      headers: { "idempotency-key": `key-second-${platformId}` },
      body,
    });
    const res2 = await provisionPost(req2);
    expect(res2.status).toBe(409);
    const json = await res2.json();
    expect(json.error?.code).toBe("CONFLICT");
  });

  it("status endpoint updates status and writes audit row", async () => {
    (verifyInternalApiJwt as jest.Mock).mockResolvedValue(undefined);
    const platformId = crypto.randomUUID();
    const idempotencyKey = `status-audit-${platformId}`;
    const body = {
      platformDealershipId: platformId,
      legalName: "Status Audit Corp",
      displayName: "StatusAudit",
      planKey: "starter",
    };
    const provReq = nextRequest("http://localhost/api/internal/provision/dealership", {
      headers: { "idempotency-key": idempotencyKey },
      body,
    });
    const provRes = await provisionPost(provReq);
    expect(provRes.status).toBe(201);
    const { dealerDealershipId } = await provRes.json();

    const statusReq = nextRequest(`http://localhost/api/internal/dealerships/${dealerDealershipId}/status`, {
      body: { status: "SUSPENDED", reason: "Test audit" },
    });
    const statusRes = await statusPost(statusReq, {
      params: Promise.resolve({ dealerDealershipId }),
    });
    expect(statusRes.status).toBe(200);

    const audit = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerDealershipId,
        action: "platform.status.set",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeDefined();
    expect((audit?.metadata as { afterStatus?: string })?.afterStatus).toBe("SUSPENDED");
  });
});
