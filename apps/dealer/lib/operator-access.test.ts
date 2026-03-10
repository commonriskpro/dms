/** @jest-environment node */
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));
jest.mock("@/lib/cookie", () => ({
  SUPPORT_SESSION_COOKIE: "dms_support_session",
  decryptSupportSessionPayload: jest.fn(),
}));

import { cookies } from "next/headers";
import { decryptSupportSessionPayload } from "@/lib/cookie";
import { hasDealerOperatorAccess } from "./operator-access";

function nextRequest(headers?: Headers): import("next/server").NextRequest {
  return { headers: headers ?? new Headers() } as unknown as import("next/server").NextRequest;
}

describe("hasDealerOperatorAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.METRICS_SECRET;
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue(null),
    });
  });

  it("returns true for the configured bearer secret", async () => {
    process.env.METRICS_SECRET = "metrics-secret";
    const headers = new Headers({ Authorization: "Bearer metrics-secret" });

    await expect(hasDealerOperatorAccess(nextRequest(headers))).resolves.toBe(true);
    expect(cookies).not.toHaveBeenCalled();
  });

  it("returns true for a valid support-session cookie", async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "encrypted" }),
    });
    (decryptSupportSessionPayload as jest.Mock).mockReturnValue({
      dealershipId: "deal-1",
      platformUserId: "platform-user-1",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expect(hasDealerOperatorAccess(nextRequest())).resolves.toBe(true);
  });

  it("returns false for an expired support-session cookie", async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "encrypted" }),
    });
    (decryptSupportSessionPayload as jest.Mock).mockReturnValue({
      dealershipId: "deal-1",
      platformUserId: "platform-user-1",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    await expect(hasDealerOperatorAccess(nextRequest())).resolves.toBe(false);
  });
});
