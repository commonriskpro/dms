/**
 * Centralized tenant status enforcement: SUSPENDED blocks writes; CLOSED blocks read and write.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  dealership: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { requireTenantActiveForRead, requireTenantActiveForWrite, getDealershipLifecycleStatus } from "./tenant-status";
import { ApiError } from "@/lib/auth";

describe("tenant-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requireTenantActiveForWrite throws TENANT_SUSPENDED when lifecycleStatus is SUSPENDED", async () => {
    prismaMock.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "SUSPENDED" });
    await expect(requireTenantActiveForWrite("deal-1")).rejects.toMatchObject({
      code: "TENANT_SUSPENDED",
      message: expect.stringContaining("suspended"),
    });
  });

  it("requireTenantActiveForRead does not throw when lifecycleStatus is SUSPENDED", async () => {
    prismaMock.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "SUSPENDED" });
    await expect(requireTenantActiveForRead("deal-1")).resolves.toBeUndefined();
  });

  it("requireTenantActiveForWrite throws TENANT_CLOSED when lifecycleStatus is CLOSED", async () => {
    prismaMock.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "CLOSED" });
    await expect(requireTenantActiveForWrite("deal-1")).rejects.toMatchObject({
      code: "TENANT_CLOSED",
      message: expect.stringContaining("closed"),
    });
  });

  it("requireTenantActiveForRead throws TENANT_CLOSED when lifecycleStatus is CLOSED", async () => {
    prismaMock.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "CLOSED" });
    await expect(requireTenantActiveForRead("deal-1")).rejects.toMatchObject({
      code: "TENANT_CLOSED",
      message: expect.stringContaining("closed"),
    });
  });

  it("both guards pass when lifecycleStatus is ACTIVE", async () => {
    prismaMock.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "ACTIVE" });
    await expect(requireTenantActiveForRead("deal-1")).resolves.toBeUndefined();
    await expect(requireTenantActiveForWrite("deal-1")).resolves.toBeUndefined();
  });

  it("getDealershipLifecycleStatus returns status or null", async () => {
    prismaMock.dealership.findUnique.mockResolvedValue(null);
    await expect(getDealershipLifecycleStatus("deal-1")).resolves.toBeNull();
    prismaMock.dealership.findUnique.mockResolvedValue({ lifecycleStatus: "SUSPENDED" });
    await expect(getDealershipLifecycleStatus("deal-1")).resolves.toBe("SUSPENDED");
  });
});
