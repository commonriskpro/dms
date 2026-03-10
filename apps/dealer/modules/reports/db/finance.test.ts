/** @jest-environment node */

jest.mock("@/lib/db", () => ({
  prisma: {
    dealFinance: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { listFinanceForContractedDealsInRange } from "./finance";

describe("reports db finance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.dealFinance.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("uses a single dealFinance query with a nested contracted-deal filter", async () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const to = new Date("2026-01-31T23:59:59.999Z");

    await listFinanceForContractedDealsInRange("dealer-1", from, to);

    expect(prisma.dealFinance.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.dealFinance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dealershipId: "dealer-1",
          deletedAt: null,
          deal: expect.objectContaining({
            dealershipId: "dealer-1",
            status: "CONTRACTED",
            deletedAt: null,
            createdAt: { gte: from, lte: to },
          }),
        }),
      })
    );
  });
});
