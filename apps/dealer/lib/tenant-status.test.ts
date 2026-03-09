/** @jest-environment node */
/**
 * Centralized tenant status enforcement: SUSPENDED blocks writes; CLOSED blocks read and write.
 */
jest.mock("@/lib/db", () => ({
  prisma: { dealership: { findUnique: jest.fn() } },
}));

import { prisma } from "@/lib/db";
import { requireTenantActiveForRead, requireTenantActiveForWrite, getDealershipLifecycleStatus } from "./tenant-status";
import { ApiError } from "@/lib/auth";

describe("tenant-status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requireTenantActiveForWrite throws TENANT_SUSPENDED when lifecycleStatus is SUSPENDED", async () => {
    prisma.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "SUSPENDED" });
    await expect(requireTenantActiveForWrite("deal-1")).rejects.toMatchObject({
      code: "TENANT_SUSPENDED",
      message: expect.stringContaining("suspended"),
    });
  });

  it("requireTenantActiveForRead does not throw when lifecycleStatus is SUSPENDED", async () => {
    prisma.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "SUSPENDED" });
    await expect(requireTenantActiveForRead("deal-1")).resolves.toBeUndefined();
  });

  it("requireTenantActiveForWrite throws TENANT_CLOSED when lifecycleStatus is CLOSED", async () => {
    prisma.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "CLOSED" });
    await expect(requireTenantActiveForWrite("deal-1")).rejects.toMatchObject({
      code: "TENANT_CLOSED",
      message: expect.stringContaining("closed"),
    });
  });

  it("requireTenantActiveForRead throws TENANT_CLOSED when lifecycleStatus is CLOSED", async () => {
    prisma.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "CLOSED" });
    await expect(requireTenantActiveForRead("deal-1")).rejects.toMatchObject({
      code: "TENANT_CLOSED",
      message: expect.stringContaining("closed"),
    });
  });

  it("both guards pass when lifecycleStatus is ACTIVE", async () => {
    prisma.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "ACTIVE" });
    await expect(requireTenantActiveForRead("deal-1")).resolves.toBeUndefined();
    await expect(requireTenantActiveForWrite("deal-1")).resolves.toBeUndefined();
  });

  it("getDealershipLifecycleStatus returns status or null", async () => {
    prisma.dealership.findUnique.mockResolvedValue(null);
    await expect(getDealershipLifecycleStatus("deal-1")).resolves.toBeNull();
    prisma.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "SUSPENDED" });
    await expect(getDealershipLifecycleStatus("deal-1")).resolves.toBe("SUSPENDED");
  });
});
