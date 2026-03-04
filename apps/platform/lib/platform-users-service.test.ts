/**
 * listPlatformUsers: role filter is passed to Prisma where.
 */
jest.mock("react", () => ({ cache: (f: unknown) => f }));
jest.mock("@/lib/db", () => ({
  prisma: {
    platformUser: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));
jest.mock("@/lib/platform-auth", () => ({
  PlatformApiError: class PlatformApiError extends Error {
    constructor(public code: string, message: string, public status: number = 403) {
      super(message);
      this.name = "PlatformApiError";
    }
  },
}));
jest.mock("@/lib/audit", () => ({ platformAuditLog: jest.fn() }));

import { prisma } from "@/lib/db";
import { listPlatformUsers } from "./platform-users-service";

describe("listPlatformUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.platformUser.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.platformUser.count as jest.Mock).mockResolvedValue(0);
  });

  it("passes role filter to findMany when role=PLATFORM_OWNER", async () => {
    await listPlatformUsers({
      limit: 20,
      offset: 0,
      role: "PLATFORM_OWNER",
    });
    expect(prisma.platformUser.findMany).toHaveBeenCalledWith(
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
    expect(prisma.platformUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });
});
