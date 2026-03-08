/**
 * Deal Desk: getDealDeskData, saveFullDealDesk. Integration tests when DB available.
 * @jest-environment node
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import * as dealService from "../service/deal";
import * as dealDeskService from "../service/deal-desk";
import * as financeService from "@/modules/finance-shell/service";
import { ApiError } from "@/lib/auth";


const dealerId = "61000000-0000-0000-0000-000000000001";
const userId = "62000000-0000-0000-0000-000000000002";

async function ensureDeal(): Promise<{ dealId: string }> {
  await prisma.dealership.upsert({
    where: { id: dealerId },
    create: { id: dealerId, name: "Desk Dealer" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userId },
    create: { id: userId, email: `desk-${randomUUID().slice(0, 8)}@test.local` },
    update: {},
  });
  const customer = await prisma.customer.upsert({
    where: { id: "63000000-0000-0000-0000-000000000003" },
    create: {
      id: "63000000-0000-0000-0000-000000000003",
      dealershipId: dealerId,
      name: "Desk Customer",
      status: "LEAD",
    },
    update: {},
  });
  const vehicleId = randomUUID();
  await prisma.vehicle.upsert({
    where: { id: vehicleId },
    create: {
      id: vehicleId,
      dealershipId: dealerId,
      stockNumber: `DSK-${vehicleId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {},
  });
  const deal = await dealService.createDeal(dealerId, userId, {
    customerId: customer.id,
    vehicleId,
    salePriceCents: BigInt(20000),
    purchasePriceCents: BigInt(16000),
    taxRateBps: 700,
    docFeeCents: BigInt(500),
  });
  return { dealId: deal.id };
}

describe("Deal Desk", () => {
  let dealId: string;

  beforeAll(async () => {
    const { dealId: id } = await ensureDeal();
    dealId = id;
  });

  describe("getDealDeskData", () => {
    it("returns deal, activity, and audit scoped to dealership", async () => {
      const desk = await dealDeskService.getDealDeskData(dealerId, dealId);
      expect(desk.deal).toBeDefined();
      expect(desk.deal.id).toBe(dealId);
      expect(desk.deal.customer).toBeDefined();
      expect(desk.deal.vehicle).toBeDefined();
      expect(Array.isArray(desk.activity)).toBe(true);
      expect(Array.isArray(desk.audit)).toBe(true);
      expect(typeof desk.activityTotal).toBe("number");
      expect(typeof desk.auditTotal).toBe("number");
    });

    it("throws NOT_FOUND for wrong dealership", async () => {
      const otherDealer = "61000000-0000-0000-0000-000000000099";
      await expect(dealDeskService.getDealDeskData(otherDealer, dealId)).rejects.toThrow(
        ApiError
      );
    });

    it("throws NOT_FOUND for non-existent deal", async () => {
      const badId = randomUUID();
      await expect(dealDeskService.getDealDeskData(dealerId, badId)).rejects.toThrow(
        ApiError
      );
    });
  });

  describe("saveFullDealDesk", () => {
    it("updates deal fields and returns updated deal", async () => {
      const updated = await dealDeskService.saveFullDealDesk(
        dealerId,
        userId,
        dealId,
        {
          salePriceCents: BigInt(21000),
          notes: "Desk note",
        }
      );
      expect(updated.salePriceCents).toBe("21000");
      expect(updated.notes).toBe("Desk note");
    });

    it("updates finance when cashDownCents/termMonths/aprBps provided", async () => {
      await financeService.putFinance(
        dealerId,
        userId,
        dealId,
        { financingMode: "FINANCE", termMonths: 60, aprBps: 599 },
        {}
      );
      const updated = await dealDeskService.saveFullDealDesk(
        dealerId,
        userId,
        dealId,
        { termMonths: 72, aprBps: 499 }
      );
      expect(updated.dealFinance).toBeDefined();
      expect(updated.dealFinance?.termMonths).toBe(72);
      expect(updated.dealFinance?.aprBps).toBe(499);
    });

    it("replaces fees: save with fees array then reload reflects them", async () => {
      await dealDeskService.saveFullDealDesk(dealerId, userId, dealId, {
        fees: [
          { label: "Fee A", amountCents: BigInt(1000), taxable: false },
          { label: "Fee B", amountCents: BigInt(500), taxable: true },
        ],
      });
      const desk = await dealDeskService.getDealDeskData(dealerId, dealId);
      expect(desk.deal.fees).toHaveLength(2);
      const labels = desk.deal.fees!.map((f) => f.label).sort();
      expect(labels).toEqual(["Fee A", "Fee B"]);
      expect(desk.deal.fees!.find((f) => f.label === "Fee A")!.amountCents).toBe("1000");
    });

    it("replaces fees: empty array removes all fees", async () => {
      await dealDeskService.saveFullDealDesk(dealerId, userId, dealId, { fees: [] });
      const desk = await dealDeskService.getDealDeskData(dealerId, dealId);
      expect(desk.deal.fees ?? []).toHaveLength(0);
    });

    it("upserts trade then remove with null", async () => {
      await dealDeskService.saveFullDealDesk(dealerId, userId, dealId, {
        trade: {
          vehicleDescription: "2015 Honda",
          allowanceCents: BigInt(10000),
          payoffCents: BigInt(3000),
        },
      });
      let desk = await dealDeskService.getDealDeskData(dealerId, dealId);
      expect(desk.deal.trades).toHaveLength(1);
      expect(desk.deal.trades![0].vehicleDescription).toBe("2015 Honda");
      await dealDeskService.saveFullDealDesk(dealerId, userId, dealId, { trade: null });
      desk = await dealDeskService.getDealDeskData(dealerId, dealId);
      expect(desk.deal.trades ?? []).toHaveLength(0);
    });

    it("save/reload consistency: full desk round-trip", async () => {
      await dealDeskService.saveFullDealDesk(dealerId, userId, dealId, {
        salePriceCents: BigInt(25000),
        docFeeCents: BigInt(600),
        notes: "Round-trip note",
        fees: [{ label: "Doc", amountCents: BigInt(200), taxable: false }],
        trade: {
          vehicleDescription: "Trade 1",
          allowanceCents: BigInt(5000),
          payoffCents: BigInt(2000),
        },
        termMonths: 60,
        aprBps: 599,
      });
      const desk = await dealDeskService.getDealDeskData(dealerId, dealId);
      expect(desk.deal.salePriceCents).toBe("25000");
      expect(desk.deal.docFeeCents).toBe("600");
      expect(desk.deal.notes).toBe("Round-trip note");
      expect(desk.deal.fees).toHaveLength(1);
      expect(desk.deal.fees![0].amountCents).toBe("200");
      expect(desk.deal.trades).toHaveLength(1);
      expect(desk.deal.trades![0].allowanceCents).toBe("5000");
      expect(desk.deal.dealFinance?.termMonths).toBe(60);
      expect(desk.deal.dealFinance?.aprBps).toBe(599);
    });

    it("throws NOT_FOUND for wrong dealership", async () => {
      const otherDealer = "61000000-0000-0000-0000-000000000099";
      await expect(
        dealDeskService.saveFullDealDesk(otherDealer, userId, dealId, { notes: "x" })
      ).rejects.toThrow(ApiError);
    });

    it("CONTRACTED deal rejects save", async () => {
      await dealService.updateDealStatus(dealerId, userId, dealId, "STRUCTURED");
      await dealService.updateDealStatus(dealerId, userId, dealId, "APPROVED");
      await dealService.updateDealStatus(dealerId, userId, dealId, "CONTRACTED");
      await expect(
        dealDeskService.saveFullDealDesk(dealerId, userId, dealId, { notes: "x" })
      ).rejects.toThrow(ApiError);
    });
  });
});
