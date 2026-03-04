/**
 * listPlatformUsers: role filter is passed to Prisma where.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  platformUser: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));
vi.mock("react", () => ({ cache: (f: unknown) => f }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/platform-auth", () => ({
  PlatformApiError: class PlatformApiError extends Error {
    constructor(public code: string, message: string, public status: number = 403) {
      super(message);
      this.name = "PlatformApiError";
    }
  },
}));
vi.mock("@/lib/audit", () => ({ platformAuditLog: vi.fn() }));

import { listPlatformUsers } from "./platform-users-service";

describe("listPlatformUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.platformUser.findMany.mockResolvedValue([]);
    prismaMock.platformUser.count.mockResolvedValue(0);
  });

  it("passes role filter to findMany when role=PLATFORM_OWNER", async () => {
    await listPlatformUsers({
      limit: 20,
      offset: 0,
      role: "PLATFORM_OWNER",
    });
    expect(prismaMock.platformUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "PLATFORM_OWNER" },
        take: 20,
        skip: 0,
      })
    );
  });

  it("does not add role to where when role is not a platform role", async () => {
    await listPlatformUsers({
      limit: 10,
      offset: 0,
      role: "UNKNOWN",
    });
    expect(prismaMock.platformUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });
});
