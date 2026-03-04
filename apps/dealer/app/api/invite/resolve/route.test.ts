jest.mock("@/modules/platform-admin/service/invite", () => ({
  resolveInvite: jest.fn(),
}));

jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: () => true,
  getClientIdentifier: () => "test-client",
}));

import { GET } from "./route";
import { resolveInvite } from "@/modules/platform-admin/service/invite";

function nextRequest(url: string): import("next/server").NextRequest {
  return { url } as import("next/server").NextRequest;
}

describe("GET /api/invite/resolve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 404 INVITE_NOT_FOUND when token does not match any invite", async () => {
    const { ApiError } = await import("@/lib/auth");
    (resolveInvite as jest.Mock).mockRejectedValue(new ApiError("INVITE_NOT_FOUND", "Invite not found"));

    const req = nextRequest("http://localhost/api/invite/resolve?token=bad-token");
    const res = await GET(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_NOT_FOUND");
    expect(body.error?.message).toBeDefined();
    expect(body.error?.message).not.toContain("token");
    expect(resolveInvite).toHaveBeenCalledWith("bad-token");
  });

  it("returns 410 INVITE_EXPIRED when invite status is EXPIRED", async () => {
    const { ApiError } = await import("@/lib/auth");
    (resolveInvite as jest.Mock).mockRejectedValue(new ApiError("INVITE_EXPIRED", "This invite has expired"));

    const req = nextRequest("http://localhost/api/invite/resolve?token=valid");
    const res = await GET(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_EXPIRED");
    expect(body.error?.message).toBeDefined();
  });

  it("returns 410 INVITE_EXPIRED when invite status is CANCELLED", async () => {
    const { ApiError } = await import("@/lib/auth");
    (resolveInvite as jest.Mock).mockRejectedValue(new ApiError("INVITE_EXPIRED", "This invite has expired"));

    const req = nextRequest("http://localhost/api/invite/resolve?token=valid");
    const res = await GET(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_EXPIRED");
  });

  it("returns 410 INVITE_EXPIRED when expiresAt is in the past", async () => {
    const { ApiError } = await import("@/lib/auth");
    (resolveInvite as jest.Mock).mockRejectedValue(new ApiError("INVITE_EXPIRED", "This invite has expired"));

    const req = nextRequest("http://localhost/api/invite/resolve?token=valid");
    const res = await GET(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_EXPIRED");
  });

  it("returns 410 INVITE_ALREADY_ACCEPTED when invite status is ACCEPTED", async () => {
    const { ApiError } = await import("@/lib/auth");
    (resolveInvite as jest.Mock).mockRejectedValue(
      new ApiError("INVITE_ALREADY_ACCEPTED", "This invite has already been used")
    );

    const req = nextRequest("http://localhost/api/invite/resolve?token=used");
    const res = await GET(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_ALREADY_ACCEPTED");
    expect(body.error?.message).toBeDefined();
  });

  it("returns 422 when token is missing", async () => {
    const req = nextRequest("http://localhost/api/invite/resolve");
    const res = await GET(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(resolveInvite).not.toHaveBeenCalled();
  });

  it("returns 422 when token exceeds max length (invalid format)", async () => {
    const longToken = "a".repeat(257);
    const req = nextRequest(`http://localhost/api/invite/resolve?token=${encodeURIComponent(longToken)}`);
    const res = await GET(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(resolveInvite).not.toHaveBeenCalled();
  });

  it("returns 200 with invite details and emailMasked (no token in response) when invite is valid", async () => {
    const expiresAt = new Date(Date.now() + 86400000);
    (resolveInvite as jest.Mock).mockResolvedValue({
      inviteId: "inv-1",
      dealershipName: "Test Dealership",
      roleName: "Manager",
      expiresAt,
      emailMasked: "j***@example.com",
    });

    const req = nextRequest("http://localhost/api/invite/resolve?token=valid");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      inviteId: "inv-1",
      dealershipName: "Test Dealership",
      roleName: "Manager",
      expiresAt: expiresAt.toISOString(),
      emailMasked: "j***@example.com",
    });
    expect(JSON.stringify(body)).not.toContain("token");
  });
});
