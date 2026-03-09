/**
 * Route tests for POST /api/messages/email:
 * - RBAC: guardPermission(crm.write) → 403 when missing.
 * - Validation: invalid body → 400.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/integrations/service/email", () => ({
  sendEmailMessage: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { POST } from "./route";
import * as emailService from "@/modules/integrations/service/email";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["crm.write"],
};

describe("POST /api/messages/email", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (emailService.sendEmailMessage as jest.Mock).mockResolvedValue({ activityId: "act-1" });
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = {
      json: () =>
        Promise.resolve({
          customerId: "c1000000-0000-0000-0000-000000000001",
          email: "cust@example.com",
          subject: "Subject",
          body: "Body",
        }),
    } as unknown as NextRequest;
    const res = await POST(request);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
    expect(emailService.sendEmailMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when email is invalid", async () => {
    const request = {
      json: () =>
        Promise.resolve({
          customerId: "c1000000-0000-0000-0000-000000000001",
          email: "not-an-email",
          subject: "Subject",
          body: "Body",
        }),
    } as unknown as NextRequest;
    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(emailService.sendEmailMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when subject is empty", async () => {
    const request = {
      json: () =>
        Promise.resolve({
          customerId: "c1000000-0000-0000-0000-000000000001",
          email: "cust@example.com",
          subject: "",
          body: "Body",
        }),
    } as unknown as NextRequest;
    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(emailService.sendEmailMessage).not.toHaveBeenCalled();
  });

  it("returns 201 and calls service with ctx.dealershipId when valid", async () => {
    const request = {
      json: () =>
        Promise.resolve({
          customerId: "c1000000-0000-0000-0000-000000000001",
          email: "cust@example.com",
          subject: "Test",
          body: "Hello",
        }),
    } as unknown as NextRequest;
    const res = await POST(request);
    expect(res.status).toBe(201);
    expect(emailService.sendEmailMessage).toHaveBeenCalledWith(
      ctx.dealershipId,
      "c1000000-0000-0000-0000-000000000001",
      "cust@example.com",
      "Test",
      "Hello",
      ctx.userId
    );
    const data = await res.json();
    expect(data.data?.activityId).toBe("act-1");
    expect(data.data?.success).toBe(true);
  });
});
