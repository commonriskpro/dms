jest.mock("@/lib/api/handler", () => ({
  getAuthContext: jest.fn(),
  guardPermission: jest.fn().mockResolvedValue(undefined),
  handleApiError: jest.fn((e: unknown) => {
    const err = e as { code?: string };
    if (err?.code === "FORBIDDEN") {
      return Response.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, { status: 403 });
    }
    return Response.json({ error: { code: "INTERNAL", message: "Unknown" } }, { status: 500 });
  }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/modules/notifications/service/notifications", () => ({
  listForUser: jest.fn(),
}));

import { ApiError } from "@/lib/auth";
import { getAuthContext, guardPermission } from "@/lib/api/handler";
import * as notificationsService from "@/modules/notifications/service/notifications";
import { GET } from "./route";

const authContext = {
  userId: "660e8400-e29b-41d4-a716-446655440000",
  email: "user@test.local",
  dealershipId: "550e8400-e29b-41d4-a716-446655440000",
  permissions: ["notifications.read"],
};

describe("GET /api/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(authContext);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns paginated notifications", async () => {
    (notificationsService.listForUser as jest.Mock).mockResolvedValue({
      items: [{ id: "n1", title: "Deal sold", readAt: null }],
      total: 1,
    });
    const req = new Request(
      "http://localhost/api/notifications?limit=10&offset=0&unreadOnly=true"
    );
    const res = await GET(req as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data.total).toBe(1);
    expect(notificationsService.listForUser).toHaveBeenCalledWith(
      authContext.dealershipId,
      authContext.userId,
      { limit: 10, offset: 0, unreadOnly: true }
    );
  });

  it("returns 403 when permission check fails", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Forbidden"));
    const req = new Request("http://localhost/api/notifications");
    const res = await GET(req as import("next/server").NextRequest);
    expect(res.status).toBe(403);
  });
});
