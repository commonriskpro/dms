jest.mock("@/lib/call-platform-internal", () => ({
  fetchEntitlementsForDealership: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    membership: { count: jest.fn() },
  },
}));

import {
  countActiveMemberships,
  assertSeatAvailableForActivation,
  requireModuleEntitlement,
  canAccessModule,
  canShowModuleInNav,
} from "@/lib/entitlements";
import { fetchEntitlementsForDealership } from "@/lib/call-platform-internal";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";

describe("entitlements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("countActiveMemberships", () => {
    it("returns count of memberships with disabledAt null", async () => {
      (prisma.membership.count as jest.Mock).mockResolvedValue(5);
      const result = await countActiveMemberships("deal-1");
      expect(result).toBe(5);
      expect(prisma.membership.count).toHaveBeenCalledWith({
        where: { dealershipId: "deal-1", disabledAt: null },
      });
    });
  });

  describe("assertSeatAvailableForActivation", () => {
    it("does not throw when entitlements are null (fail open)", async () => {
      (fetchEntitlementsForDealership as jest.Mock).mockResolvedValue(null);
      await expect(assertSeatAvailableForActivation("deal-1")).resolves.toBeUndefined();
      expect(fetchEntitlementsForDealership).toHaveBeenCalledWith("deal-1");
    });

    it("does not throw when maxSeats is null (unlimited)", async () => {
      (fetchEntitlementsForDealership as jest.Mock).mockResolvedValue({ modules: [], maxSeats: null });
      await expect(assertSeatAvailableForActivation("deal-1")).resolves.toBeUndefined();
      expect(fetchEntitlementsForDealership).toHaveBeenCalledWith("deal-1");
    });

    it("does not throw when current count is below maxSeats", async () => {
      (fetchEntitlementsForDealership as jest.Mock).mockResolvedValue({ modules: [], maxSeats: 10 });
      (prisma.membership.count as jest.Mock).mockResolvedValue(5);
      await expect(assertSeatAvailableForActivation("deal-1")).resolves.toBeUndefined();
    });

    it("does not throw when current count equals maxSeats - 1 (one more seat available)", async () => {
      (fetchEntitlementsForDealership as jest.Mock).mockResolvedValue({ modules: [], maxSeats: 10 });
      (prisma.membership.count as jest.Mock).mockResolvedValue(9);
      await expect(assertSeatAvailableForActivation("deal-1")).resolves.toBeUndefined();
    });

    it("throws SEAT_LIMIT_REACHED when current >= maxSeats", async () => {
      (fetchEntitlementsForDealership as jest.Mock).mockResolvedValue({ modules: [], maxSeats: 10 });
      (prisma.membership.count as jest.Mock).mockResolvedValue(10);
      await expect(assertSeatAvailableForActivation("deal-1")).rejects.toMatchObject({
        code: "SEAT_LIMIT_REACHED",
        message: expect.stringContaining("Seat limit reached"),
      });
    });
  });

  describe("requireModuleEntitlement", () => {
    it("does not throw when entitlements are null (fail open)", async () => {
      (fetchEntitlementsForDealership as jest.Mock).mockResolvedValue(null);
      await expect(requireModuleEntitlement("deal-1", "reports")).resolves.toBeUndefined();
      expect(fetchEntitlementsForDealership).toHaveBeenCalledWith("deal-1");
    });

    it("does not throw when module is in entitlements.modules", async () => {
      (fetchEntitlementsForDealership as jest.Mock).mockResolvedValue({ modules: ["reports", "inventory"], maxSeats: null });
      await expect(requireModuleEntitlement("deal-1", "reports")).resolves.toBeUndefined();
    });

    it("throws FORBIDDEN when module is not in entitlements.modules", async () => {
      (fetchEntitlementsForDealership as jest.Mock).mockResolvedValue({ modules: ["inventory"], maxSeats: null });
      await expect(requireModuleEntitlement("deal-1", "reports")).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Module not included in your plan",
      });
    });
  });

  describe("canAccessModule", () => {
    it("returns false when entitlements is null", () => {
      expect(canAccessModule(null, ["dashboard.read"], "dashboard")).toBe(false);
    });

    it("returns false when module is not in entitlements.modules", () => {
      expect(canAccessModule({ modules: ["inventory"], maxSeats: null }, ["inventory.read"], "dashboard")).toBe(false);
    });

    it("returns true when module is in entitlements and user has required permission", () => {
      expect(canAccessModule({ modules: ["dashboard"], maxSeats: null }, ["dashboard.read"], "dashboard")).toBe(true);
    });

    it("returns false when module is in entitlements but user lacks permission", () => {
      expect(canAccessModule({ modules: ["dashboard"], maxSeats: null }, [], "dashboard")).toBe(false);
    });

    it("returns true when module has no MODULE_TO_PERMISSIONS entry (treated as any)", () => {
      expect(canAccessModule({ modules: ["unknown-module"], maxSeats: null }, [], "unknown-module")).toBe(true);
    });
  });

  describe("canShowModuleInNav", () => {
    it("returns true when moduleKey is undefined", () => {
      expect(canShowModuleInNav(null, [], undefined)).toBe(true);
    });

    it("returns true when entitlements is null (fail open for nav)", () => {
      expect(canShowModuleInNav(null, [], "reports")).toBe(true);
    });

    it("returns result of canAccessModule when entitlements and moduleKey are set", () => {
      expect(canShowModuleInNav({ modules: ["reports"], maxSeats: null }, ["reports.read"], "reports")).toBe(true);
      expect(canShowModuleInNav({ modules: ["reports"], maxSeats: null }, [], "reports")).toBe(false);
    });
  });
});
