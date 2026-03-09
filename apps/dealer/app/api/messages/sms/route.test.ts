/**
 * Route tests for POST /api/messages/sms:
 * - RBAC: guardPermission(crm.write) → 403 when missing.
 * - Validation: invalid body (missing message, bad UUID, etc.) → 400.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/integrations/service/sms", () => ({
  sendSmsMessage: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { POST } from "./route";
import * as smsService from "@/modules/integrations/service/sms";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["crm.write"],
};

describe("POST /api/messages/sms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (smsService.sendSmsMessage as jest.Mock).mockResolvedValue({ activityId: "act-1" });
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const request = {
      json: () =>
        Promise.resolve({
          customerId: "c1000000-0000-0000-0000-000000000001",
          phone: "+15551234567",
          message: "Hi",
        }),
    } as unknown as NextRequest;
    const res = await POST(request);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
    expect(smsService.sendSmsMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when body is invalid (missing message)", async () => {
    const request = {
      json: () =>
        Promise.resolve({
          customerId: "c1000000-0000-0000-0000-000000000001",
          phone: "+15551234567",
          message: "",
        }),
    } as unknown as NextRequest;
    const res = await POST(request);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
    expect(smsService.sendSmsMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when customerId is not a UUID", async () => {
    const request = {
      json: () =>
        Promise.resolve({
          customerId: "not-a-uuid",
          phone: "+15551234567",
          message: "Hi",
        }),
    } as unknown as NextRequest;
    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(smsService.sendSmsMessage).not.toHaveBeenCalled();
  });

  it("returns 201 and calls service with ctx.dealershipId when valid", async () => {
    const request = {
      json: () =>
        Promise.resolve({
          customerId: "c1000000-0000-0000-0000-000000000001",
          phone: "+15551234567",
          message: "Hello",
        }),
    } as unknown as NextRequest;
    const res = await POST(request);
    expect(res.status).toBe(201);
    expect(smsService.sendSmsMessage).toHaveBeenCalledWith(
      ctx.dealershipId,
      "c1000000-0000-0000-0000-000000000001",
      "+15551234567",
      "Hello",
      ctx.userId
    );
    const data = await res.json();
    expect(data.data?.activityId).toBe("act-1");
    expect(data.data?.success).toBe(true);
  });
});
