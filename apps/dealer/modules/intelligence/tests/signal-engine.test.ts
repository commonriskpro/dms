/** @jest-environment node */
jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
  requireTenantActiveForWrite: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    customerTask: { count: jest.fn() },
    opportunity: { count: jest.fn() },
    deal: { count: jest.fn() },
    financeSubmission: { count: jest.fn() },
    dealTitle: { groupBy: jest.fn() },
    intelligenceSignal: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    vehicleAppraisal: { count: jest.fn() },
    inventorySourceLead: { count: jest.fn() },
  },
}));

jest.mock("../db/signals", () => ({
  upsertActiveSignal: jest.fn(),
  resolveActiveSignalByCode: jest.fn(),
  listSignals: jest.fn(),
}));

import { prisma } from "@/lib/db";
import * as signalsDb from "../db/signals";
import {
  listSignalsForDealership,
  runSignalEngine,
} from "../service/signal-engine";

const dealershipId = "d1000000-0000-0000-0000-000000000001";

describe("signal-engine service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { recon_count: BigInt(3), aged_count: BigInt(5) },
    ]);
    (prisma.customerTask.count as jest.Mock).mockResolvedValue(2);
    (prisma.opportunity.count as jest.Mock).mockResolvedValue(4);
    (prisma.deal.count as jest.Mock).mockResolvedValue(1);
    (prisma.financeSubmission.count as jest.Mock).mockResolvedValue(2);
    (prisma.dealTitle.groupBy as jest.Mock).mockResolvedValue([
      { titleStatus: "ISSUE_HOLD", _count: { _all: 1 } },
      { titleStatus: "TITLE_PENDING", _count: { _all: 3 } },
    ]);
    (prisma.intelligenceSignal.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.intelligenceSignal.create as jest.Mock).mockResolvedValue({ id: "sig-created" });
    (prisma.intelligenceSignal.update as jest.Mock).mockResolvedValue({ id: "sig-updated" });
    (prisma.intelligenceSignal.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.vehicleAppraisal.count as jest.Mock).mockResolvedValue(0);
    (prisma.inventorySourceLead.count as jest.Mock).mockResolvedValue(0);

    (signalsDb.upsertActiveSignal as jest.Mock).mockResolvedValue({
      action: "created",
      signal: { id: "sig-1" },
    });
    (signalsDb.resolveActiveSignalByCode as jest.Mock).mockResolvedValue(1);
  });

  it("runs all domain generators and returns per-domain counters", async () => {
    const result = await runSignalEngine(dealershipId);

    expect(result.dealershipId).toBe(dealershipId);
    expect(result.inventory.created).toBe(2);
    expect(result.crm.created).toBe(2);
    expect(result.deals.created).toBe(2);
    expect(result.operations.created).toBe(2);
    expect(result.acquisition.resolved).toBe(0);

    expect(prisma.intelligenceSignal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dealershipId,
          domain: "INVENTORY",
        }),
      })
    );
    expect(prisma.intelligenceSignal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dealershipId,
          domain: "ACQUISITION",
        }),
      })
    );
  });

  it("lists signals with tenant scope and api serialization", async () => {
    (signalsDb.listSignals as jest.Mock).mockResolvedValue({
      data: [
        {
          id: "sig-2",
          dealershipId,
          domain: "CRM",
          code: "crm.followup_overdue",
          severity: "WARNING",
          title: "Follow-ups overdue",
          description: "2 customer follow-up task(s) are overdue.",
          entityType: null,
          entityId: null,
          actionLabel: "Open tasks",
          actionHref: "/customers",
          metadata: { count: 2 },
          happenedAt: new Date("2026-03-07T10:00:00Z"),
          resolvedAt: null,
          createdAt: new Date("2026-03-07T10:00:00Z"),
          updatedAt: new Date("2026-03-07T10:05:00Z"),
        },
      ],
      total: 1,
    });

    const result = await listSignalsForDealership(dealershipId, {
      domain: "crm",
      severity: "warning",
      includeResolved: false,
      limit: 200,
      offset: 0,
    });

    expect(signalsDb.listSignals).toHaveBeenCalledWith(
      expect.objectContaining({
        dealershipId,
        domain: "crm",
        severity: "warning",
        limit: 100,
      })
    );
    expect(result.total).toBe(1);
    expect(result.data[0].domain).toBe("crm");
    expect(result.data[0].severity).toBe("warning");
    expect(result.data[0].metadata).toMatchObject({ count: 2 });
  });
});
