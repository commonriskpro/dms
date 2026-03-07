/**
 * Tests for GET /api/crm/inbox/conversations:
 * - RBAC: guardPermission(customers.read) → 403 when missing.
 * - Returns 200 with data and meta when permitted.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/customers/service/inbox", () => ({
  listConversations: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET } from "./route";
import * as inboxService from "@/modules/customers/service/inbox";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["customers.read"],
};

describe("GET /api/crm/inbox/conversations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (inboxService.listConversations as jest.Mock).mockResolvedValue({
      data: [
        {
          customerId: "c1",
          customerName: "Alice",
          lastMessagePreview: "Hi",
          lastMessageAt: "2026-03-07T12:00:00Z",
          channel: "sms",
          direction: "inbound",
        },
      ],
      meta: { total: 1, limit: 25, offset: 0 },
    });
  });

  function request(searchParams?: string): NextRequest {
    const url = searchParams
      ? `https://example.com/api/crm/inbox/conversations?${searchParams}`
      : "https://example.com/api/crm/inbox/conversations";
    return { nextUrl: new URL(url), url } as unknown as NextRequest;
  }

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );
    const res = await GET(request());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
    expect(inboxService.listConversations).not.toHaveBeenCalled();
  });

  it("returns 200 and calls listConversations with dealershipId and pagination", async () => {
    const res = await GET(request("limit=10&offset=0"));
    expect(res.status).toBe(200);
    expect(inboxService.listConversations).toHaveBeenCalledWith(ctx.dealershipId, {
      limit: 10,
      offset: 0,
    });
    const data = await res.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].customerName).toBe("Alice");
    expect(data.meta.total).toBe(1);
  });
});
