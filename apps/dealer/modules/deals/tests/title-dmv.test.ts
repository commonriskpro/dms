/** @jest-environment node */
/**
 * Title and DMV service: lifecycle, checklist, audit.
 * Mocks db and tenant; no DB required.
 */
import * as titleService from "../service/title";
import * as dmvService from "../service/dmv";
import * as dealDb from "../db/deal";
import * as titleDb from "../db/title";
import * as dmvDb from "../db/dmv";
import { auditLog } from "@/lib/audit";

jest.mock("../db/deal");
jest.mock("../db/title");
jest.mock("../db/dmv");
jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForWrite: jest.fn().mockResolvedValue(undefined),
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));

const dealershipId = "a0000000-0000-0000-0000-000000000001";
const userId = "b0000000-0000-0000-0000-000000000002";
const dealId = "c0000000-0000-0000-0000-000000000003";

describe("Title service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("startTitleProcess returns NOT_FOUND when deal missing", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue(null);
    await expect(
      titleService.startTitleProcess(dealershipId, userId, dealId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(titleDb.createDealTitleRecord).not.toHaveBeenCalled();
  });

  it("startTitleProcess creates TITLE_PENDING and audits deal.title_started", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue({ id: dealId });
    (titleDb.getDealTitle as jest.Mock).mockResolvedValue(null);
    const created = { id: "t1", dealId, titleStatus: "TITLE_PENDING" };
    (titleDb.createDealTitleRecord as jest.Mock).mockResolvedValue(created);

    const result = await titleService.startTitleProcess(dealershipId, userId, dealId);
    expect(result).toEqual(created);
    expect(titleDb.createDealTitleRecord).toHaveBeenCalledWith(dealershipId, dealId, "TITLE_PENDING");
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deal.title_started",
        entity: "DealTitle",
        metadata: expect.objectContaining({ titleStatus: "TITLE_PENDING" }),
      })
    );
  });

  it("startTitleProcess returns CONFLICT when title already exists", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue({ id: dealId });
    (titleDb.getDealTitle as jest.Mock).mockResolvedValue({ id: "t1" });
    await expect(
      titleService.startTitleProcess(dealershipId, userId, dealId)
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(titleDb.createDealTitleRecord).not.toHaveBeenCalled();
  });

  it("markTitleSent updates status and audits deal.title_sent", async () => {
    const title = { id: "t1", dealId };
    (titleDb.getDealTitle as jest.Mock).mockResolvedValue(title);
    (titleDb.updateDealTitleStatus as jest.Mock).mockResolvedValue({ ...title, titleStatus: "TITLE_SENT" });

    await titleService.markTitleSent(dealershipId, userId, dealId);
    expect(titleDb.updateDealTitleStatus).toHaveBeenCalledWith(
      dealershipId,
      dealId,
      expect.objectContaining({ titleStatus: "TITLE_SENT" })
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deal.title_sent" })
    );
  });

  it("completeTitle sets TITLE_COMPLETED and audits", async () => {
    const title = { id: "t1", dealId };
    (titleDb.getDealTitle as jest.Mock).mockResolvedValue(title);
    (titleDb.updateDealTitleStatus as jest.Mock).mockResolvedValue({ ...title, titleStatus: "TITLE_COMPLETED" });

    await titleService.completeTitle(dealershipId, userId, dealId);
    expect(titleDb.updateDealTitleStatus).toHaveBeenCalledWith(dealershipId, dealId, {
      titleStatus: "TITLE_COMPLETED",
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deal.title_completed" })
    );
  });
});

describe("DMV service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("createChecklistItemsForDeal returns NOT_FOUND when deal missing", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue(null);
    await expect(
      dmvService.createChecklistItemsForDeal(dealershipId, userId, dealId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dmvDb.createChecklistItems).not.toHaveBeenCalled();
  });

  it("createChecklistItemsForDeal uses default labels when none provided", async () => {
    (dealDb.getDealById as jest.Mock).mockResolvedValue({ id: dealId });
    (dmvDb.listChecklistItems as jest.Mock).mockResolvedValue([]);
    (dmvDb.createChecklistItems as jest.Mock).mockResolvedValue([
      { id: "i1", label: "Buyer docs complete" },
      { id: "i2", label: "Odometer disclosure signed" },
    ]);

    const result = await dmvService.createChecklistItemsForDeal(dealershipId, userId, dealId);
    expect(dmvDb.createChecklistItems).toHaveBeenCalledWith(
      dealershipId,
      dealId,
      expect.arrayContaining(["Buyer docs complete", "Odometer disclosure signed"])
    );
    expect(result.length).toBe(2);
  });

  it("toggleChecklistItem returns NOT_FOUND when item missing", async () => {
    (dmvDb.getChecklistItemById as jest.Mock).mockResolvedValue(null);
    await expect(
      dmvService.toggleChecklistItem(dealershipId, userId, "item-1", true)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dmvDb.toggleChecklistItem).not.toHaveBeenCalled();
  });

  it("toggleChecklistItem updates completed and completedAt", async () => {
    (dmvDb.getChecklistItemById as jest.Mock).mockResolvedValue({ id: "item-1", dealId });
    (dmvDb.toggleChecklistItem as jest.Mock).mockResolvedValue({
      id: "item-1",
      completed: true,
      completedAt: new Date(),
    });

    const result = await dmvService.toggleChecklistItem(dealershipId, userId, "item-1", true);
    expect(dmvDb.toggleChecklistItem).toHaveBeenCalledWith(dealershipId, "item-1", true);
    expect(result?.completed).toBe(true);
  });
});
