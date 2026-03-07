/** @jest-environment node */
/**
 * Delivery and funding service: state transitions, validation, audit.
 * Mocks db and tenant so no DB migration required.
 */
import * as deliveryService from "../service/delivery";
import * as fundingService from "../service/funding";
import * as dealDb from "../db/deal";
import * as fundingDb from "../db/funding";
import { auditLog } from "@/lib/audit";

jest.mock("../db/deal");
jest.mock("../db/funding");
jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForWrite: jest.fn().mockResolvedValue(undefined),
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

const dealershipId = "a0000000-0000-0000-0000-000000000001";
const userId = "b0000000-0000-0000-0000-000000000002";
const dealId = "c0000000-0000-0000-0000-000000000003";

describe("Delivery service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("markDealReadyForDelivery requires CONTRACTED status", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue({
      id: dealId,
      status: "APPROVED",
      deliveryStatus: null,
    });
    (dealDb.updateDealDelivery as jest.Mock).mockResolvedValue({});

    await expect(
      deliveryService.markDealReadyForDelivery(dealershipId, userId, dealId)
    ).rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("CONTRACTED") });

    expect(dealDb.updateDealDelivery).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("markDealReadyForDelivery sets READY_FOR_DELIVERY and audits", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue({
      id: dealId,
      status: "CONTRACTED",
      deliveryStatus: null,
    });
    const updated = { id: dealId, deliveryStatus: "READY_FOR_DELIVERY" };
    (dealDb.updateDealDelivery as jest.Mock).mockResolvedValue(updated);

    const result = await deliveryService.markDealReadyForDelivery(
      dealershipId,
      userId,
      dealId
    );
    expect(result).toEqual(updated);
    expect(dealDb.updateDealDelivery).toHaveBeenCalledWith(dealershipId, dealId, {
      deliveryStatus: "READY_FOR_DELIVERY",
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deal.delivery_ready",
        entity: "Deal",
        entityId: dealId,
        metadata: expect.objectContaining({ deliveryStatus: "READY_FOR_DELIVERY" }),
      })
    );
  });

  it("markDealDelivered requires READY_FOR_DELIVERY", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue({
      id: dealId,
      deliveryStatus: null,
    });
    await expect(
      deliveryService.markDealDelivered(dealershipId, userId, dealId)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(dealDb.updateDealDelivery).not.toHaveBeenCalled();
  });

  it("markDealDelivered sets DELIVERED and deliveredAt and audits", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue({
      id: dealId,
      deliveryStatus: "READY_FOR_DELIVERY",
    });
    const updated = { id: dealId, deliveryStatus: "DELIVERED", deliveredAt: new Date() };
    (dealDb.updateDealDelivery as jest.Mock).mockResolvedValue(updated);

    const result = await deliveryService.markDealDelivered(
      dealershipId,
      userId,
      dealId
    );
    expect(result).toEqual(updated);
    expect(dealDb.updateDealDelivery).toHaveBeenCalledWith(dealershipId, dealId, {
      deliveryStatus: "DELIVERED",
      deliveredAt: expect.any(Date),
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deal.delivered",
        entity: "Deal",
        entityId: dealId,
        metadata: expect.objectContaining({ deliveryStatus: "DELIVERED" }),
      })
    );
  });
});

describe("Funding service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("createFundingRecord returns NOT_FOUND when deal missing", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue(null);
    await expect(
      fundingService.createFundingRecord(
        dealershipId,
        userId,
        dealId,
        { fundingAmountCents: BigInt(100000) }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fundingDb.createDealFunding).not.toHaveBeenCalled();
  });

  it("createFundingRecord creates PENDING record and audits", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue({ id: dealId });
    const created = {
      id: "f0000000-0000-0000-0000-000000000004",
      dealId,
      fundingStatus: "PENDING",
      fundingAmountCents: BigInt(100000),
    };
    (fundingDb.createDealFunding as jest.Mock).mockResolvedValue(created);

    const result = await fundingService.createFundingRecord(
      dealershipId,
      userId,
      dealId,
      { fundingAmountCents: BigInt(100000), notes: "Test" }
    );
    expect(result).toEqual(created);
    expect(fundingDb.createDealFunding).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId,
        dealershipId,
        fundingAmountCents: BigInt(100000),
        notes: "Test",
      })
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deal.funding_created",
        entity: "DealFunding",
        metadata: expect.objectContaining({ fundingStatus: "PENDING" }),
      })
    );
  });

  it("updateFundingStatus to FUNDED emits deal.funded audit", async () => {
    const fundingId = "f0000000-0000-0000-0000-000000000005";
    (fundingDb.getDealFundingByDealAndId as jest.Mock).mockResolvedValue({
      id: fundingId,
      dealId,
      fundingDate: null,
    });
    (fundingDb.updateDealFunding as jest.Mock).mockResolvedValue({
      id: fundingId,
      fundingStatus: "FUNDED",
      fundingDate: new Date(),
    });

    await fundingService.updateFundingStatus(
      dealershipId,
      userId,
      dealId,
      fundingId,
      { fundingStatus: "FUNDED" }
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deal.funded",
        entity: "DealFunding",
        entityId: fundingId,
        metadata: expect.objectContaining({ fundingStatus: "FUNDED" }),
      })
    );
  });
});
