jest.mock("@/modules/notifications/db/notifications", () => ({
  createNotification: jest.fn(),
  createNotificationsForUsers: jest.fn(),
  listByUser: jest.fn(),
  markRead: jest.fn(),
  listActiveMemberUserIds: jest.fn(),
}));

jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
  requireTenantActiveForWrite: jest.fn().mockResolvedValue(undefined),
}));

import * as notificationsDb from "@/modules/notifications/db/notifications";
import {
  createForActiveMembers,
  createForUser,
  listForUser,
  markAsRead,
} from "@/modules/notifications/service/notifications";

describe("notifications service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists notifications scoped by dealership/user", async () => {
    (notificationsDb.listByUser as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    const result = await listForUser(
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440000",
      { limit: 25, offset: 0, unreadOnly: true }
    );
    expect(result.total).toBe(0);
    expect(notificationsDb.listByUser).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440000",
      { limit: 25, offset: 0, unreadOnly: true }
    );
  });

  it("creates for one user", async () => {
    (notificationsDb.createNotification as jest.Mock).mockResolvedValue({ id: "n1" });
    const created = await createForUser(
      "550e8400-e29b-41d4-a716-446655440000",
      "660e8400-e29b-41d4-a716-446655440000",
      { title: "Deal sold", kind: "deal.sold" }
    );
    expect(created.id).toBe("n1");
  });

  it("creates notifications for all active members", async () => {
    (notificationsDb.listActiveMemberUserIds as jest.Mock).mockResolvedValue([
      "660e8400-e29b-41d4-a716-446655440000",
      "770e8400-e29b-41d4-a716-446655440000",
    ]);
    (notificationsDb.createNotificationsForUsers as jest.Mock).mockResolvedValue(2);

    const count = await createForActiveMembers(
      "550e8400-e29b-41d4-a716-446655440000",
      { title: "New customer created", kind: "customer.created" }
    );
    expect(count).toBe(2);
    expect(notificationsDb.createNotificationsForUsers).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440000",
      [
        "660e8400-e29b-41d4-a716-446655440000",
        "770e8400-e29b-41d4-a716-446655440000",
      ],
      { title: "New customer created", kind: "customer.created" }
    );
  });

  it("throws NOT_FOUND when mark-read target is missing", async () => {
    (notificationsDb.markRead as jest.Mock).mockResolvedValue(null);
    await expect(
      markAsRead(
        "550e8400-e29b-41d4-a716-446655440000",
        "660e8400-e29b-41d4-a716-446655440000",
        "770e8400-e29b-41d4-a716-446655440000"
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
