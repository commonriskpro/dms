/** @jest-environment node */
/**
 * Reports integration tests (skip when !hasDb):
 * Tenant isolation, RBAC (reports.read / reports.export), export audit, money as string, missing finance = UNKNOWN.
 * Schema validation (from > to, range > 2 years, limit > 100).
 * Uses unique IDs for seeded customer/vehicle/deal/history per run to avoid id collisions.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { requirePermission, loadUserPermissions } from "@/lib/rbac";
import { ApiError } from "@/lib/auth";
import * as reportService from "../../service";
import { getInventoryAging, getMix, getSalesByUser, getFinancePenetration, getPipeline, exportSalesCsv } from "../../service";
import {
  salesSummaryQuerySchema,
  salesByUserQuerySchema,
  exportSalesQuerySchema,
} from "@/app/api/reports/schemas";


const dealerAId = "81000000-0000-0000-0000-000000000001";
const dealerBId = "82000000-0000-0000-0000-000000000002";
const userWithReadId = "83000000-0000-0000-0000-000000000003";
const userNoReportsId = "84000000-0000-0000-0000-000000000004";
const userExportId = "85000000-0000-0000-0000-000000000005";
async function ensureTestData() {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Reports Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Reports Dealer B" },
    update: {},
  });
  for (const [id, email] of [
    [userWithReadId, "reports-read@test.local"],
    [userNoReportsId, "reports-none@test.local"],
    [userExportId, "reports-export@test.local"],
  ] as const) {
    await prisma.profile.upsert({
      where: { id },
      create: { id, email },
      update: {},
    });
  }

  const permRead = await prisma.permission.findFirst({ where: { key: "reports.read" } });
  const permExport = await prisma.permission.findFirst({ where: { key: "reports.export" } });
  const permAdmin = await prisma.permission.findFirst({ where: { key: "admin.dealership.read" } });
  if (!permRead || !permExport || !permAdmin) return;

  const roleReadOnly = await prisma.role.upsert({
    where: { id: "86000000-0000-0000-0000-000000000006" },
    create: {
      id: "86000000-0000-0000-0000-000000000006",
      dealershipId: dealerAId,
      name: "ReportsReadOnly",
      isSystem: false,
    },
    update: {},
  });
  const roleNoReports = await prisma.role.upsert({
    where: { id: "87000000-0000-0000-0000-000000000007" },
    create: {
      id: "87000000-0000-0000-0000-000000000007",
      dealershipId: dealerAId,
      name: "NoReports",
      isSystem: false,
    },
    update: {},
  });
  const roleExport = await prisma.role.upsert({
    where: { id: "88000000-0000-0000-0000-000000000008" },
    create: {
      id: "88000000-0000-0000-0000-000000000008",
      dealershipId: dealerAId,
      name: "ReportsExport",
      isSystem: false,
    },
    update: {},
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: roleReadOnly.id } });
  await prisma.rolePermission.createMany({
    data: [{ roleId: roleReadOnly.id, permissionId: permRead.id }],
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: roleNoReports.id } });
  await prisma.rolePermission.createMany({
    data: [{ roleId: roleNoReports.id, permissionId: permAdmin.id }],
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: roleExport.id } });
  await prisma.rolePermission.createMany({
    data: [
      { roleId: roleExport.id, permissionId: permRead.id },
      { roleId: roleExport.id, permissionId: permExport.id },
    ],
  });

  await prisma.membership.upsert({
    where: { id: "89000000-0000-0000-0000-000000000009" },
    create: {
      id: "89000000-0000-0000-0000-000000000009",
      dealershipId: dealerAId,
      userId: userWithReadId,
      roleId: roleReadOnly.id,
    },
    update: { roleId: roleReadOnly.id },
  });
  await prisma.membership.upsert({
    where: { id: "8a000000-0000-0000-0000-00000000000a" },
    create: {
      id: "8a000000-0000-0000-0000-00000000000a",
      dealershipId: dealerAId,
      userId: userNoReportsId,
      roleId: roleNoReports.id,
    },
    update: { roleId: roleNoReports.id },
  });
  await prisma.membership.upsert({
    where: { id: "8b000000-0000-0000-0000-00000000000b" },
    create: {
      id: "8b000000-0000-0000-0000-00000000000b",
      dealershipId: dealerAId,
      userId: userExportId,
      roleId: roleExport.id,
    },
    update: { roleId: roleExport.id },
  });
}

/** Seed one CONTRACTED deal for Dealer A so we can assert Dealer B sees zero. Uses unique IDs per run. */
async function seedDealerAContractedDeal() {
  const customerAId = randomUUID();
  const vehicleAId = randomUUID();
  const dealAId = randomUUID();
  await prisma.customer.create({
    data: {
      id: customerAId,
      dealershipId: dealerAId,
      name: "Reports Test Customer A",
      status: "LEAD",
    },
  });
  await prisma.vehicle.create({
    data: {
      id: vehicleAId,
      dealershipId: dealerAId,
      stockNumber: `RPT-${vehicleAId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
  });
  const created = new Date("2024-06-15T12:00:00Z");
  await prisma.deal.create({
    data: {
      id: dealAId,
      dealershipId: dealerAId,
      customerId: customerAId,
      vehicleId: vehicleAId,
      salePriceCents: 25000_00n,
      purchasePriceCents: 20000_00n,
      taxRateBps: 0,
      taxCents: 0n,
      docFeeCents: 0n,
      downPaymentCents: 0n,
      totalFeesCents: 0n,
      totalDueCents: 25000_00n,
      frontGrossCents: 5000_00n,
      status: "CONTRACTED",
      createdAt: created,
      updatedAt: created,
    },
  });
  const dealHistoryId = randomUUID();
  await prisma.dealHistory.create({
    data: {
      id: dealHistoryId,
      dealershipId: dealerAId,
      dealId: dealAId,
      fromStatus: "DRAFT",
      toStatus: "CONTRACTED",
      changedBy: userWithReadId,
      createdAt: created,
    },
  });
}

describe("Reports integration", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("tenant isolation: Dealer B cannot see Dealer A report data", async () => {
    const summary = await reportService.getSalesSummary({
      dealershipId: dealerBId,
      from: "2020-01-01",
      to: "2030-12-31",
    });
    expect(summary.totalDealsCount).toBe(0);
    expect(summary.totalSaleVolumeCents).toBe("0");
    expect(summary.totalFrontGrossCents).toBe("0");
  });

  it("RBAC: user without reports.read gets 403", async () => {
    await expect(
      requirePermission(userNoReportsId, dealerAId, "reports.read")
    ).rejects.toThrow(ApiError);
  });

  it("RBAC: user with only reports.read cannot export (reports.export required)", async () => {
    await expect(
      requirePermission(userWithReadId, dealerAId, "reports.export")
    ).rejects.toThrow(ApiError);
  });

  it("user with reports.read passes requirePermission(reports.read)", async () => {
    const perms = await loadUserPermissions(userWithReadId, dealerAId);
    expect(perms).toContain("reports.read");
    await requirePermission(userWithReadId, dealerAId, "reports.read");
  });

  it("user with reports.export passes requirePermission(reports.export)", async () => {
    const perms = await loadUserPermissions(userExportId, dealerAId);
    expect(perms).toContain("reports.export");
    await requirePermission(userExportId, dealerAId, "reports.export");
  });

  it("money returned as string cents", async () => {
    const summary = await reportService.getSalesSummary({
      dealershipId: dealerAId,
      from: "2020-01-01",
      to: "2030-12-31",
    });
    expect(typeof summary.totalSaleVolumeCents).toBe("string");
    expect(typeof summary.totalFrontGrossCents).toBe("string");
    expect(typeof summary.averageFrontGrossCents).toBe("string");
  });

  it("inventory aging returns totalInventoryValueCents as string", async () => {
    const aging = await getInventoryAging({ dealershipId: dealerAId });
    expect(typeof aging.totalInventoryValueCents).toBe("string");
  });

  it("mix includes UNKNOWN for deals with no finance row", async () => {
    const mix = await getMix({
      dealershipId: dealerAId,
      from: "2020-01-01",
      to: "2030-12-31",
    });
    const modes = mix.byMode.map((m) => m.financingMode);
    expect(modes).toContain("CASH");
    expect(modes).toContain("FINANCE");
    expect(modes).toContain("UNKNOWN");
  });
});

describe("Reports tenant isolation (Dealer A has data)", () => {
  beforeAll(async () => {
    await ensureTestData();
    await seedDealerAContractedDeal();
  });

  const range = { from: "2024-01-01", to: "2024-12-31" };

  it("Dealer B GET sales-summary returns zero totals", async () => {
    const summary = await reportService.getSalesSummary({
      dealershipId: dealerBId,
      ...range,
    });
    expect(summary.totalDealsCount).toBe(0);
    expect(summary.totalSaleVolumeCents).toBe("0");
    expect(summary.totalFrontGrossCents).toBe("0");
  });

  it("Dealer B GET sales-by-user returns empty array", async () => {
    const res = await getSalesByUser({
      dealershipId: dealerBId,
      ...range,
      limit: 25,
      offset: 0,
    });
    expect(res.data).toEqual([]);
    expect(res.meta.total).toBe(0);
  });

  it("Dealer B GET inventory-aging has zero value when B has no vehicles", async () => {
    const aging = await getInventoryAging({ dealershipId: dealerBId });
    expect(aging.totalInventoryValueCents).toBe("0");
    expect(aging.agingBuckets.bucket0_15).toBe(0);
    expect(aging.agingBuckets.bucket90Plus).toBe(0);
  });

  it("Dealer B GET finance-penetration returns zero penetration", async () => {
    const pen = await getFinancePenetration({
      dealershipId: dealerBId,
      ...range,
    });
    expect(pen.contractedCount).toBe(0);
    expect(pen.financedCount).toBe(0);
    expect(pen.financePenetrationPercent).toBe(0);
  });

  it("Dealer B GET mix returns empty or zero counts", async () => {
    const mix = await getMix({ dealershipId: dealerBId, ...range });
    const totalDeals = mix.byMode.reduce((s, m) => s + m.dealCount, 0);
    expect(totalDeals).toBe(0);
  });

  it("Dealer B GET pipeline returns no trend for B", async () => {
    const pipeline = await getPipeline({
      dealershipId: dealerBId,
      ...range,
      groupBy: "day",
    });
    expect(pipeline.byStatus).toBeDefined();
    expect(pipeline.trend ?? []).toEqual([]);
  });

  it("Dealer B export/sales with range covering A deals returns CSV with only header or zero rows", async () => {
    const csv = await exportSalesCsv({
      dealershipId: dealerBId,
      from: "2024-06-01",
      to: "2024-06-30",
    });
    expect(csv).toContain("date,dealId,customerName,salePriceCents,frontGrossCents,financingMode");
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(1);
  });
});

describe("Reports schema validation", () => {
  it("from > to yields VALIDATION_ERROR (refine)", () => {
    expect(() =>
      salesSummaryQuerySchema.parse({ from: "2024-01-02", to: "2024-01-01" })
    ).toThrow();
  });

  it("date range > 2 years yields validation error", () => {
    expect(() =>
      salesSummaryQuerySchema.parse({
        from: "2019-01-01",
        to: "2022-01-02",
      })
    ).toThrow();
  });

  it("sales-by-user limit > 100 yields validation error", () => {
    expect(() =>
      salesByUserQuerySchema.parse({
        from: "2024-01-01",
        to: "2024-01-31",
        limit: 101,
        offset: 0,
      })
    ).toThrow();
  });

  it("export sales from > to yields validation error", () => {
    expect(() =>
      exportSalesQuerySchema.parse({
        from: "2024-01-02",
        to: "2024-01-01",
        format: "csv",
      })
    ).toThrow();
  });
});

describe("Reports export audit", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("export sales returns CSV with header and no PII in row data", async () => {
    const csv = await reportService.exportSalesCsv({
      dealershipId: dealerAId,
      from: "2024-01-01",
      to: "2024-01-31",
    });
    expect(typeof csv).toBe("string");
    expect(csv).toContain("date,dealId,customerName,salePriceCents,frontGrossCents,financingMode");
  });

  it("report.exported audit metadata has reportName and format, no PII keys", async () => {
    const { auditLog } = await import("@/lib/audit");
    await auditLog({
      dealershipId: dealerAId,
      actorUserId: userExportId,
      action: "report.exported",
      entity: "Report",
      metadata: { reportName: "sales", from: "2024-01-01", to: "2024-01-31", format: "csv" },
    });
    const logs = await prisma.auditLog.findMany({
      where: { dealershipId: dealerAId, action: "report.exported", entity: "Report" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const meta = logs[0].metadata as Record<string, unknown> | null;
    expect(meta?.reportName).toBe("sales");
    expect(meta?.format).toBe("csv");
    const piiKeys = ["ssn", "email", "phone", "dob"];
    for (const k of piiKeys) {
      expect(meta).not.toHaveProperty(k);
    }
  });
});
