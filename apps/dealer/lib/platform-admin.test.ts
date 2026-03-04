import { ApiError } from "@/lib/auth";
import { isPlatformAdmin, requirePlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/db";

jest.mock("react", () => ({
  cache: (fn: (userId: string) => Promise<boolean>) => fn,
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    platformAdmin: {
      findUnique: jest.fn(),
    },
  },
}));

describe("Platform admin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("isPlatformAdmin returns true when record exists", async () => {
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: "pa-1",
      userId: "user-1",
      createdAt: new Date(),
      createdBy: null,
    });
    const result = await isPlatformAdmin("user-1");
    expect(result).toBe(true);
    expect(prisma.platformAdmin.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true },
    });
  });

  it("isPlatformAdmin returns false when record does not exist", async () => {
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await isPlatformAdmin("user-2");
    expect(result).toBe(false);
  });

  it("requirePlatformAdmin does not throw when user is platform admin", async () => {
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue({
      id: "pa-1",
      userId: "user-1",
      createdAt: new Date(),
      createdBy: null,
    });
    await expect(requirePlatformAdmin("user-1")).resolves.toBeUndefined();
  });

  it("requirePlatformAdmin throws FORBIDDEN when user is not platform admin", async () => {
    (prisma.platformAdmin.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(requirePlatformAdmin("user-2")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Platform admin access required",
    });
    await expect(requirePlatformAdmin("user-2")).rejects.toBeInstanceOf(ApiError);
  });
});
