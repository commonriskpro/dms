jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getCurrentUser: jest.fn(),
    requireUser: jest.fn(),
  };
});

jest.mock("@/modules/platform-admin/service/invite", () => ({
  acceptInvite: jest.fn(),
  acceptInviteWithSignup: jest.fn(),
}));

jest.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: () => true,
  checkRateLimitInviteAcceptPerToken: () => true,
  getClientIdentifier: () => "test-client",
}));

import { POST } from "./route";
import { ApiError, getCurrentUser, requireUser } from "@/lib/auth";
import { acceptInvite, acceptInviteWithSignup } from "@/modules/platform-admin/service/invite";

function nextRequest(
  body: object,
  opts?: { contentLength?: string }
): import("next/server").NextRequest {
  const headers = new Headers();
  if (opts?.contentLength) headers.set("content-length", opts.contentLength);
  return {
    url: "http://localhost/api/invite/accept",
    json: () => Promise.resolve(body),
    headers,
  } as unknown as import("next/server").NextRequest;
}

describe("POST /api/invite/accept", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCurrentUser as jest.Mock).mockResolvedValue({ userId: "user-1", email: "user@example.com" });
    (requireUser as jest.Mock).mockResolvedValue({
      userId: "user-1",
      email: "user@example.com",
    });
  });

  it("returns 422 when token is missing in body", async () => {
    const req = nextRequest({});
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it("returns 422 when token exceeds max length (invalid format)", async () => {
    const req = nextRequest({ token: "x".repeat(257) });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(acceptInvite).not.toHaveBeenCalled();
  });

  it("returns 404 INVITE_NOT_FOUND when token does not match any invite", async () => {
    const { ApiError } = await import("@/lib/auth");
    (acceptInvite as jest.Mock).mockRejectedValue(new ApiError("INVITE_NOT_FOUND", "Invite not found"));
    const req = nextRequest({ token: "unknown-token" });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_NOT_FOUND");
    expect(JSON.stringify(body)).not.toContain("unknown-token");
  });

  it("returns 413 PAYLOAD_TOO_LARGE when content-length exceeds 4KB", async () => {
    const req = nextRequest(
      { token: "t".repeat(4097) },
      { contentLength: "4100" }
    );
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error?.code).toBe("PAYLOAD_TOO_LARGE");
    expect(acceptInvite).not.toHaveBeenCalled();
    expect(acceptInviteWithSignup).not.toHaveBeenCalled();
  });

  it("returns 410 INVITE_EXPIRED when service throws INVITE_EXPIRED", async () => {
    (acceptInvite as jest.Mock).mockRejectedValue(new ApiError("INVITE_EXPIRED", "This invite has expired"));

    const req = nextRequest({ token: "expired-token" });
    const res = await POST(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_EXPIRED");
    expect(body.error?.message).toBeDefined();
    expect(JSON.stringify(body)).not.toContain("expired-token");
  });

  it("returns 410 INVITE_ALREADY_ACCEPTED when service throws INVITE_ALREADY_ACCEPTED", async () => {
    (acceptInvite as jest.Mock).mockRejectedValue(
      new ApiError("INVITE_ALREADY_ACCEPTED", "This invite has already been used")
    );

    const req = nextRequest({ token: "used-token" });
    const res = await POST(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error?.code).toBe("INVITE_ALREADY_ACCEPTED");
    expect(JSON.stringify(body)).not.toContain("used-token");
  });

  it("returns 200 with alreadyHadMembership: true when user already has membership (idempotent)", async () => {
    (acceptInvite as jest.Mock).mockResolvedValue({
      membershipId: "mem-1",
      dealershipId: "dlr-1",
      alreadyHadMembership: true,
    });

    const req = nextRequest({ token: "valid-token" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      membershipId: "mem-1",
      dealershipId: "dlr-1",
      alreadyHadMembership: true,
    });
    expect(JSON.stringify(body)).not.toContain("valid-token");
  });

  it("returns 200 with membershipId and dealershipId when accept creates new membership", async () => {
    (acceptInvite as jest.Mock).mockResolvedValue({
      membershipId: "mem-new",
      dealershipId: "dlr-1",
    });

    const req = nextRequest({ token: "valid-token" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.membershipId).toBe("mem-new");
    expect(body.data.dealershipId).toBe("dlr-1");
    expect(body.data.alreadyHadMembership).toBeUndefined();
  });

  describe("signup path (no auth, token + email + password)", () => {
    beforeEach(() => {
      (getCurrentUser as jest.Mock).mockResolvedValue(null);
    });

    it("returns 200 with membershipId and dealershipId when signup succeeds", async () => {
      (acceptInviteWithSignup as jest.Mock).mockResolvedValue({
        membershipId: "mem-new",
        dealershipId: "dlr-1",
      });

      const req = nextRequest({
        token: "valid-token",
        email: "new@example.com",
        password: "SecurePass1!word",
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.membershipId).toBe("mem-new");
      expect(body.data.dealershipId).toBe("dlr-1");
      expect(acceptInviteWithSignup).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "valid-token",
          email: "new@example.com",
          password: "SecurePass1!word",
        }),
        expect.any(Object)
      );
    });

    it("returns 403 INVITE_EMAIL_MISMATCH when email does not match invite", async () => {
      const { ApiError } = await import("@/lib/auth");
      (acceptInviteWithSignup as jest.Mock).mockRejectedValue(
        new ApiError("INVITE_EMAIL_MISMATCH", "Email does not match invitation", {
          fieldErrors: { email: "Email does not match invitation" },
        })
      );

      const req = nextRequest({
        token: "valid-token",
        email: "wrong@example.com",
        password: "SecurePass1!word",
      });
      const res = await POST(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error?.code).toBe("INVITE_EMAIL_MISMATCH");
      expect(body.error?.details?.fieldErrors?.email).toBeDefined();
    });

    it("returns 400 with fieldErrors when password is too weak", async () => {
      const req = nextRequest({
        token: "valid-token",
        email: "new@example.com",
        password: "short",
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error?.code).toBe("VALIDATION_ERROR");
      expect(body.error?.details?.fieldErrors?.password).toBeDefined();
      expect(acceptInviteWithSignup).not.toHaveBeenCalled();
    });

    it("returns 409 EMAIL_ALREADY_REGISTERED when user already exists", async () => {
      const { ApiError } = await import("@/lib/auth");
      (acceptInviteWithSignup as jest.Mock).mockRejectedValue(
        new ApiError("EMAIL_ALREADY_REGISTERED", "An account with this email already exists")
      );

      const req = nextRequest({
        token: "valid-token",
        email: "existing@example.com",
        password: "SecurePass1!word",
      });
      const res = await POST(req);

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error?.code).toBe("EMAIL_ALREADY_REGISTERED");
    });

    it("returns 410 when invite already accepted (second signup with same token)", async () => {
      const { ApiError } = await import("@/lib/auth");
      (acceptInviteWithSignup as jest.Mock).mockRejectedValue(
        new ApiError("INVITE_ALREADY_ACCEPTED", "This invite has already been used")
      );

      const req = nextRequest({
        token: "used-token",
        email: "new@example.com",
        password: "SecurePass1!word",
      });
      const res = await POST(req);

      expect(res.status).toBe(410);
      const body = await res.json();
      expect(body.error?.code).toBe("INVITE_ALREADY_ACCEPTED");
    });

    it("ignores dealershipId in body: membership is created for invite's dealership only", async () => {
      (acceptInviteWithSignup as jest.Mock).mockResolvedValue({
        membershipId: "mem-invite-dealer",
        dealershipId: "invite-dealership-id",
      });

      const req = nextRequest({
        token: "valid-token",
        email: "new@example.com",
        password: "SecurePass1!word",
        dealershipId: "wrong-dealership-id",
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.dealershipId).toBe("invite-dealership-id");
      expect(body.data.dealershipId).not.toBe("wrong-dealership-id");
      expect(acceptInviteWithSignup).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          fullName: null,
        }),
        expect.any(Object)
      );
      const firstArg = (acceptInviteWithSignup as jest.Mock).mock.calls[0]?.[0];
      expect(firstArg).not.toHaveProperty("dealershipId");
    });
  });
});
