/**
 * Platform RBAC: non-owner calling application invite-owner returns 403.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const requirePlatformAuthMock = vi.hoisted(() => vi.fn());
const requirePlatformRoleMock = vi.hoisted(() => vi.fn());
const PlatformApiErrorClass = vi.hoisted(() => {
  class PlatformApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number = 403
    ) {
      super(message);
      this.name = "PlatformApiError";
    }
  }
  return PlatformApiError;
});
vi.mock("@/lib/platform-auth", () => ({
  requirePlatformAuth: requirePlatformAuthMock,
  requirePlatformRole: requirePlatformRoleMock,
  PlatformApiError: PlatformApiErrorClass,
}));
vi.mock("@/lib/application-onboarding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/application-onboarding")>();
  return { ...actual, inviteOwnerForApplication: vi.fn() };
});

import { POST } from "./route";

describe("Platform POST application invite-owner RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when non-owner calls invite-owner", async () => {
    requirePlatformAuthMock.mockResolvedValueOnce({ userId: "user-1", role: "PLATFORM_SUPPORT" });
    requirePlatformRoleMock.mockImplementationOnce(() => {
      throw new PlatformApiErrorClass("FORBIDDEN", "Insufficient platform role", 403);
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
