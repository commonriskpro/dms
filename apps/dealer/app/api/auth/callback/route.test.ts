/** @jest-environment node */
/**
 * GET /api/auth/callback: exchange code for session, audit email_verified, redirect.
 */
import { NextRequest } from "next/server";
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn() }));

import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { GET } from "./route";

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to /login?error=invalid_link when no code", async () => {
    const req = new NextRequest("http://localhost/api/auth/callback");
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("invalid_link");
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("redirects to /login?error=invalid_link when exchange fails", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        exchangeCodeForSession: () =>
          Promise.resolve({ data: null, error: { message: "Invalid code" } }),
      },
    });
    const req = new NextRequest("http://localhost/api/auth/callback?code=bad");
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("invalid_link");
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("redirects to next path and audits when exchange succeeds", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        exchangeCodeForSession: () =>
          Promise.resolve({
            data: { user: { id: "user-uuid" }, session: {} },
            error: null,
          }),
      },
    });
    const req = new NextRequest("http://localhost/api/auth/callback?code=valid&next=/dashboard");
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard");
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.email_verified",
        entity: "Auth",
        actorUserId: "user-uuid",
        dealershipId: null,
      })
    );
  });

  it("redirects to / when next is missing", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        exchangeCodeForSession: () =>
          Promise.resolve({
            data: { user: { id: "u" }, session: {} },
            error: null,
          }),
      },
    });
    const req = new NextRequest("http://localhost/api/auth/callback?code=valid");
    const res = await GET(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  it("does not open redirect when next is //evil.com (normalizes to /)", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        exchangeCodeForSession: () =>
          Promise.resolve({
            data: { user: { id: "u" }, session: {} },
            error: null,
          }),
      },
    });
    const req = new NextRequest("http://localhost/api/auth/callback?code=valid&next=//evil.com");
    const res = await GET(req);
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("evil.com");
    expect(loc).toMatch(/\/$/);
  });

  it("does not open redirect when next contains backslash", async () => {
    (createClient as jest.Mock).mockResolvedValue({
      auth: {
        exchangeCodeForSession: () =>
          Promise.resolve({
            data: { user: { id: "u" }, session: {} },
            error: null,
          }),
      },
    });
    const req = new NextRequest("http://localhost/api/auth/callback?code=valid&next=/\\evil");
    const res = await GET(req);
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).not.toContain("evil");
    expect(loc).toMatch(/\/$/);
  });
});
