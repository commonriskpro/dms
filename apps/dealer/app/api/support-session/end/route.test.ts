/** @jest-environment node */
/**
 * POST /api/support-session/end: clears cookie, audits impersonation.ended when valid session present.
 */
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));
jest.mock("@/lib/cookie", () => ({
  SUPPORT_SESSION_COOKIE: "dms_support_session",
  decryptSupportSessionPayload: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn() }));

import { cookies } from "next/headers";
import { decryptSupportSessionPayload } from "@/lib/cookie";
import { auditLog } from "@/lib/audit";
import { POST } from "./route";

describe("POST /api/support-session/end", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockDelete = jest.fn();
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue(null),
      delete: mockDelete,
    });
  });

  it("returns 200 and clears cookie", async () => {
    const req = new Request("http://localhost/api/support-session/end", { method: "POST" });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("audits impersonation.ended when valid support session cookie present", async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "encrypted-payload" }),
      delete: jest.fn(),
    });
    (decryptSupportSessionPayload as jest.Mock).mockReturnValue({
      dealershipId: "dealership-uuid",
      platformUserId: "platform-user-uuid",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const req = new Request("http://localhost/api/support-session/end", { method: "POST" });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(auditLog).toHaveBeenCalledWith({
      dealershipId: "dealership-uuid",
      actorUserId: null,
      action: "impersonation.ended",
      entity: "SupportSession",
      metadata: { platformUserId: "platform-user-uuid" },
    });
  });

  it("does not audit when cookie is expired", async () => {
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "encrypted-payload" }),
      delete: jest.fn(),
    });
    (decryptSupportSessionPayload as jest.Mock).mockReturnValue({
      dealershipId: "dealership-uuid",
      platformUserId: "platform-user-uuid",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    const req = new Request("http://localhost/api/support-session/end", { method: "POST" });
    await POST(req as unknown as import("next/server").NextRequest);
    expect(auditLog).not.toHaveBeenCalled();
  });
});
