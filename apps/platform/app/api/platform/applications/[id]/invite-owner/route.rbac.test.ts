/**
 * Platform RBAC: non-owner calling application invite-owner returns 403.
 */
jest.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: jest.fn(),
  requirePlatformRole: jest.fn(),
  PlatformApiError: class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  },
}));
jest.mock("@/lib/rate-limit", () => ({
  checkPlatformRateLimit: () => true,
  getPlatformClientIdentifier: () => "test-client",
}));
jest.mock("@/lib/application-onboarding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/application-onboarding")>();
  return { ...actual, inviteOwnerForApplication: jest.fn() };
});

import { requirePlatformAuth, requirePlatformRole, PlatformApiError } from "@/lib/platform-auth";
import { POST } from "./route";

describe("Platform POST application invite-owner RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 422 when application id is not UUID", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "user-1" });
    (requirePlatformRole as jest.Mock).mockResolvedValueOnce(undefined);
    const req = new Request("http://localhost", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
  });

  it("returns 403 when non-owner calls invite-owner", async () => {
    (requirePlatformAuth as jest.Mock).mockResolvedValueOnce({ userId: "user-1", role: "PLATFORM_SUPPORT" });
    (requirePlatformRole as jest.Mock).mockImplementationOnce(() => {
      throw new PlatformApiError("FORBIDDEN", "Insufficient platform role", 403);
    });
    const req = new Request("http://localhost/api/platform/applications/app-1/invite-owner", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "app-1" }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error?.code).toBe("FORBIDDEN");
  });
});
