jest.mock("@/lib/api/handler", () => ({
  getAuthContext: jest.fn(),
  guardPermission: jest.fn().mockResolvedValue(undefined),
  handleApiError: jest.fn((e: unknown) => {
    const err = e as { code?: string };
    if (err?.code === "NOT_FOUND") {
      return Response.json({ error: { code: "NOT_FOUND", message: "Notification not found" } }, { status: 404 });
    }
    return Response.json({ error: { code: "INTERNAL", message: "Unknown" } }, { status: 500 });
  }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
  readSanitizedJson: jest.fn().mockResolvedValue({ read: true }),
}));

jest.mock("@/modules/notifications/service/notifications", () => ({
  markAsRead: jest.fn(),
}));

import { ApiError } from "@/lib/auth";
import { getAuthContext } from "@/lib/api/handler";
import * as notificationsService from "@/modules/notifications/service/notifications";
import { PATCH } from "./route";

const authContext = {
  userId: "660e8400-e29b-41d4-a716-446655440000",
  email: "user@test.local",
  dealershipId: "550e8400-e29b-41d4-a716-446655440000",
  permissions: ["notifications.read"],
};

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(authContext);
  });

  it("marks notification as read", async () => {
    (notificationsService.markAsRead as jest.Mock).mockResolvedValue({
      id: "770e8400-e29b-41d4-a716-446655440000",
      readAt: new Date(),
    });
    const req = new Request("http://localhost/api/notifications/770e8400-e29b-41d4-a716-446655440000", {
      method: "PATCH",
      body: JSON.stringify({ read: true }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req as import("next/server").NextRequest, {
      params: Promise.resolve({ id: "770e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(200);
    expect(notificationsService.markAsRead).toHaveBeenCalledWith(
      authContext.dealershipId,
      authContext.userId,
      "770e8400-e29b-41d4-a716-446655440000"
    );
  });

  it("returns 400 for invalid id", async () => {
    const req = new Request("http://localhost/api/notifications/not-a-uuid", { method: "PATCH" });
    const res = await PATCH(req as import("next/server").NextRequest, {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when notification not found", async () => {
    (notificationsService.markAsRead as jest.Mock).mockRejectedValue(
      new ApiError("NOT_FOUND", "Notification not found")
    );
    const req = new Request("http://localhost/api/notifications/770e8400-e29b-41d4-a716-446655440000", {
      method: "PATCH",
    });
    const res = await PATCH(req as import("next/server").NextRequest, {
      params: Promise.resolve({ id: "770e8400-e29b-41d4-a716-446655440000" }),
    });
    expect(res.status).toBe(404);
  });
});
