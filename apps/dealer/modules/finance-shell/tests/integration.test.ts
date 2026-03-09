/** @jest-environment node */
/**
 * Finance-shell integration tests (skip when !hasDb):
 * Tenant isolation, RBAC, CONTRACTED immutability, status transitions,
 * product inclusion recalculation, audit events.
 * Uses unique vehicle/deal IDs per run to avoid (dealership_id, vehicle_id) collisions.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import * as financeService from "../service";
import * as financeDb from "../db";
import { loadUserPermissions, requirePermission } from "@/lib/rbac";


const dealerAId = "e1000000-0000-0000-0000-000000000001";
const dealerBId = "e2000000-0000-0000-0000-000000000002";
const userAId = "e3000000-0000-0000-0000-000000000003";
const readOnlyUserId = "e4000000-0000-0000-0000-000000000004";
const noFinanceUserId = "e5000000-0000-0000-0000-000000000005";

async function ensureTestData(): Promise<{
  dealAId: string;
  dealBId: string;
  financeBId: string;
  productBId: string;
}> {
  const runId = randomUUID().slice(0, 8);
  const vehicleAId = randomUUID();
  const vehicleBId = randomUUID();
  const dealAId = randomUUID();
  const dealBId = randomUUID();

  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Finance Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Finance Dealer B" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: userAId },
    create: { id: userAId, email: `finance-tenant-a-${runId}@test.local` },
    update: { email: `finance-tenant-a-${runId}@test.local` },
  });
  await prisma.profile.upsert({
    where: { id: readOnlyUserId },
    create: { id: readOnlyUserId, email: `finance-readonly-${runId}@test.local` },
    update: { email: `finance-readonly-${runId}@test.local` },
  });
  await prisma.profile.upsert({
    where: { id: noFinanceUserId },
    create: { id: noFinanceUserId, email: `nofinance-${runId}@test.local` },
    update: { email: `nofinance-${runId}@test.local` },
  });

  const customerA = await prisma.customer.upsert({
    where: { id: "e6000000-0000-0000-0000-000000000006" },
    create: {
      id: "e6000000-0000-0000-0000-000000000006",
      dealershipId: dealerAId,
      name: "Customer A",
      status: "LEAD",
    },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: "e7000000-0000-0000-0000-000000000007" },
    create: {
      id: "e7000000-0000-0000-0000-000000000007",
      dealershipId: dealerBId,
      name: "Customer B",
      status: "LEAD",
    },
    update: {},
  });
  const vehicleA = await prisma.vehicle.upsert({
    where: { id: vehicleAId },
    create: {
      id: vehicleAId,
      dealershipId: dealerAId,
      stockNumber: `HFA-${vehicleAId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {},
  });
  const vehicleB = await prisma.vehicle.upsert({
    where: { id: vehicleBId },
    create: {
      id: vehicleBId,
      dealershipId: dealerBId,
      stockNumber: `HFB-${vehicleBId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {},
  });

  const dealA = await prisma.deal.upsert({
    where: { id: dealAId },
    create: {
      id: dealAId,
      dealershipId: dealerAId,
      customerId: customerA.id,
      vehicleId: vehicleA.id,
      salePriceCents: BigInt(2000000),
      purchasePriceCents: BigInt(1800000),
      taxRateBps: 700,
      taxCents: BigInt(14000),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(500),
      totalDueCents: BigInt(2014500),
      frontGrossCents: BigInt(199500),
      status: "DRAFT",
    },
    update: {},
  });
  const dealB = await prisma.deal.upsert({
    where: { id: dealBId },
    create: {
      id: dealBId,
      dealershipId: dealerBId,
      customerId: customerB.id,
      vehicleId: vehicleB.id,
      salePriceCents: BigInt(1500000),
      purchasePriceCents: BigInt(1400000),
      taxRateBps: 700,
      taxCents: BigInt(10500),
      docFeeCents: BigInt(500),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(500),
      totalDueCents: BigInt(1515500),
      frontGrossCents: BigInt(99500),
      status: "DRAFT",
    },
    update: {},
  });

  const financeBId = randomUUID();
  const productBId = randomUUID();
  const financeB = await prisma.dealFinance.upsert({
    where: { dealId: dealB.id },
    create: {
      id: financeBId,
      dealershipId: dealerBId,
      dealId: dealB.id,
      financingMode: "FINANCE",
      termMonths: 60,
      aprBps: 1200,
      cashDownCents: BigInt(0),
      amountFinancedCents: BigInt(1565500),
      monthlyPaymentCents: BigInt(33712),
      totalOfPaymentsCents: BigInt(2022720),
      financeChargeCents: BigInt(507220),
      productsTotalCents: BigInt(50000),
      backendGrossCents: BigInt(0),
      status: "DRAFT",
    },
    update: {},
  });

  const productB = await prisma.dealFinanceProduct.create({
    data: {
      id: productBId,
      dealershipId: dealerBId,
      dealFinanceId: financeB.id,
      productType: "GAP",
      name: "Dealer B GAP",
      priceCents: BigInt(50000),
      costCents: BigInt(20000),
      taxable: false,
      includedInAmountFinanced: true,
    },
  });

  return {
    dealAId: dealA.id,
    dealBId: dealB.id,
    financeBId: financeB.id,
    productBId: productB.id,
  };
}

let testData: Awaited<ReturnType<typeof ensureTestData>>;

describe("Finance-shell tenant isolation", () => {
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("getFinanceByDealId with wrong dealership throws NOT_FOUND", async () => {
    await expect(
      financeService.getFinanceByDealId(dealerAId, testData.dealBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("putFinance for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    await expect(
      financeService.putFinance(dealerAId, userAId, testData.dealBId, {
        financingMode: "FINANCE",
        termMonths: 60,
        aprBps: 1200,
        cashDownCents: BigInt(0),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("patchFinanceStatus for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    await expect(
      financeService.patchFinanceStatus(dealerAId, userAId, testData.dealBId, "STRUCTURED")
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("listProducts for Dealer B deal when called as Dealer A returns null", async () => {
    const result = await financeService.listProducts(dealerAId, testData.dealBId, {
      limit: 25,
      offset: 0,
    });
    expect(result).toBeNull();
  });

  it("addProduct for Dealer B deal when called as Dealer A throws NOT_FOUND", async () => {
    await expect(
      financeService.addProduct(dealerAId, userAId, testData.dealBId, {
        productType: "GAP",
        name: "GAP",
        priceCents: BigInt(10000),
        includedInAmountFinanced: true,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("updateProduct for Dealer B product when called as Dealer A throws NOT_FOUND", async () => {
    await expect(
      financeService.updateProduct(dealerAId, userAId, testData.dealBId, testData.productBId, {
        name: "Hacked",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deleteProduct for Dealer B product when called as Dealer A throws NOT_FOUND", async () => {
    await expect(
      financeService.deleteProduct(dealerAId, userAId, testData.dealBId, testData.productBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Finance-shell RBAC", () => {
  beforeAll(async () => {
    testData = await ensureTestData();
    const permRead = await prisma.permission.findFirst({ where: { key: "finance.read" } });
    const permWrite = await prisma.permission.findFirst({ where: { key: "finance.write" } });
    const permOther = await prisma.permission.findFirst({
      where: { key: "admin.dealership.read" },
    });
    if (!permRead || !permWrite || !permOther) return;
    await prisma.role.upsert({
      where: { id: "ed000000-0000-0000-0000-00000000000d" },
      create: {
        id: "ed000000-0000-0000-0000-00000000000d",
        dealershipId: dealerAId,
        name: "FinanceReadOnly",
        isSystem: false,
        rolePermissions: { create: [{ permissionId: permRead.id }] },
      },
      update: {},
    });
    await prisma.role.upsert({
      where: { id: "ee000000-0000-0000-0000-00000000000e" },
      create: {
        id: "ee000000-0000-0000-0000-00000000000e",
        dealershipId: dealerAId,
        name: "NoFinance",
        isSystem: false,
        rolePermissions: { create: [{ permissionId: permOther.id }] },
      },
      update: {},
    });
    await prisma.membership.upsert({
      where: { id: "ef000000-0000-0000-0000-00000000000f" },
      create: {
        id: "ef000000-0000-0000-0000-00000000000f",
        dealershipId: dealerAId,
        userId: readOnlyUserId,
        roleId: "ed000000-0000-0000-0000-00000000000d",
      },
      update: {},
    });
    await prisma.membership.upsert({
      where: { id: "e1000000-0000-0000-0000-000000000010" },
      create: {
        id: "e1000000-0000-0000-0000-000000000010",
        dealershipId: dealerAId,
        userId: noFinanceUserId,
        roleId: "ee000000-0000-0000-0000-00000000000e",
      },
      update: {},
    });
  });

  it("requirePermission(finance.read) throws FORBIDDEN for user without it", async () => {
    const perms = await loadUserPermissions(noFinanceUserId, dealerAId);
    if (perms.includes("finance.read")) return;
    await expect(
      requirePermission(noFinanceUserId, dealerAId, "finance.read")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requirePermission(finance.write) throws FORBIDDEN for read-only user", async () => {
    const perms = await loadUserPermissions(readOnlyUserId, dealerAId);
    if (perms.includes("finance.write")) return;
    await expect(
      requirePermission(readOnlyUserId, dealerAId, "finance.write")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Finance-shell CONTRACTED immutability", () => {
  let contractedDealId: string;

  beforeAll(async () => {
    testData = await ensureTestData();
    contractedDealId = randomUUID();
    const customer = await prisma.customer.findFirst({
      where: { dealershipId: dealerAId },
    });
    const contractedVehicleId = randomUUID();
    await prisma.vehicle.create({
      data: {
        id: contractedVehicleId,
        dealershipId: dealerAId,
        stockNumber: `FC-${contractedVehicleId.slice(0, 8)}`,
        status: "AVAILABLE",
      },
    });
    if (!customer) return;
    await prisma.deal.upsert({
      where: { id: contractedDealId },
      create: {
        id: contractedDealId,
        dealershipId: dealerAId,
        customerId: customer.id,
        vehicleId: contractedVehicleId,
        salePriceCents: BigInt(1000000),
        purchasePriceCents: BigInt(900000),
        taxRateBps: 700,
        taxCents: BigInt(7000),
        docFeeCents: BigInt(0),
        downPaymentCents: BigInt(0),
        totalFeesCents: BigInt(0),
        totalDueCents: BigInt(1007000),
        frontGrossCents: BigInt(100000),
        status: "CONTRACTED",
      },
      update: { status: "CONTRACTED" },
    });
    const contractedFinanceId = randomUUID();
    const contractedFinance = await prisma.dealFinance.upsert({
      where: { dealId: contractedDealId },
      create: {
        id: contractedFinanceId,
        dealershipId: dealerAId,
        dealId: contractedDealId,
        financingMode: "FINANCE",
        termMonths: 60,
        aprBps: 1200,
        cashDownCents: BigInt(0),
        amountFinancedCents: BigInt(1007000),
        monthlyPaymentCents: BigInt(22404),
        totalOfPaymentsCents: BigInt(1344240),
        financeChargeCents: BigInt(337240),
        productsTotalCents: BigInt(0),
        backendGrossCents: BigInt(0),
        status: "CONTRACTED",
      },
      update: { status: "CONTRACTED" },
    });
    await prisma.dealFinanceProduct.create({
      data: {
        id: randomUUID(),
        dealershipId: dealerAId,
        dealFinanceId: contractedFinance.id,
        productType: "VSC",
        name: "Contracted VSC",
        priceCents: BigInt(200000),
        costCents: null,
        taxable: false,
        includedInAmountFinanced: false,
      },
    });
  });

  it("putFinance when deal is CONTRACTED returns CONFLICT", async () => {
    await expect(
      financeService.putFinance(dealerAId, userAId, contractedDealId, {
        financingMode: "FINANCE",
        termMonths: 72,
        aprBps: 1200,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("patchFinanceStatus to STRUCTURED when deal is CONTRACTED returns CONFLICT", async () => {
    await expect(
      financeService.patchFinanceStatus(dealerAId, userAId, contractedDealId, "STRUCTURED")
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("addProduct when deal is CONTRACTED returns CONFLICT", async () => {
    await expect(
      financeService.addProduct(dealerAId, userAId, contractedDealId, {
        productType: "GAP",
        name: "GAP",
        priceCents: BigInt(10000),
        includedInAmountFinanced: true,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updateProduct when deal is CONTRACTED returns CONFLICT", async () => {
    const product = await prisma.dealFinanceProduct.findFirst({
      where: { dealFinance: { dealId: contractedDealId }, deletedAt: null },
    });
    if (!product) return;
    await expect(
      financeService.updateProduct(dealerAId, userAId, contractedDealId, product.id, {
        name: "Updated",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("deleteProduct when deal is CONTRACTED returns CONFLICT", async () => {
    const product = await prisma.dealFinanceProduct.findFirst({
      where: { dealFinance: { dealId: contractedDealId }, deletedAt: null },
    });
    if (!product) return;
    await expect(
      financeService.deleteProduct(dealerAId, userAId, contractedDealId, product.id)
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("Finance-shell finance.locked and DealFinance status", () => {
  let lockTestDealId: string;
  let lockFinanceId: string;

  beforeAll(async () => {
    testData = await ensureTestData();
    lockTestDealId = randomUUID();
    lockFinanceId = randomUUID();
    const customer = await prisma.customer.findFirst({
      where: { dealershipId: dealerAId },
    });
    const lockVehicleId = randomUUID();
    await prisma.vehicle.create({
      data: {
        id: lockVehicleId,
        dealershipId: dealerAId,
        stockNumber: `FL-${lockVehicleId.slice(0, 8)}`,
        status: "AVAILABLE",
      },
    });
    if (!customer) return;
    await prisma.deal.upsert({
      where: { id: lockTestDealId },
      create: {
        id: lockTestDealId,
        dealershipId: dealerAId,
        customerId: customer.id,
        vehicleId: lockVehicleId,
        salePriceCents: BigInt(1000000),
        purchasePriceCents: BigInt(900000),
        taxRateBps: 700,
        taxCents: BigInt(7000),
        docFeeCents: BigInt(0),
        downPaymentCents: BigInt(0),
        totalFeesCents: BigInt(0),
        totalDueCents: BigInt(1007000),
        frontGrossCents: BigInt(100000),
        status: "DRAFT",
      },
      update: {},
    });
    await prisma.dealFinance.upsert({
      where: { dealId: lockTestDealId },
      create: {
        id: lockFinanceId,
        dealershipId: dealerAId,
        dealId: lockTestDealId,
        financingMode: "FINANCE",
        termMonths: 60,
        aprBps: 1200,
        cashDownCents: BigInt(0),
        amountFinancedCents: BigInt(1007000),
        monthlyPaymentCents: BigInt(22404),
        totalOfPaymentsCents: BigInt(1344240),
        financeChargeCents: BigInt(337240),
        productsTotalCents: BigInt(0),
        backendGrossCents: BigInt(0),
        status: "ACCEPTED",
      },
      update: { status: "ACCEPTED" },
    });
  });

  it("lockFinanceWhenDealContracted sets DealFinance.status to CONTRACTED", async () => {
    const { lockFinanceWhenDealContracted } = await import("../service/lock");
    await lockFinanceWhenDealContracted(dealerAId, lockTestDealId);
    const finance = await financeDb.getFinanceByDealId(lockTestDealId, dealerAId);
    expect(finance?.status).toBe("CONTRACTED");
  });
});

describe("Finance-shell status transitions", () => {
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("valid transition DRAFT -> STRUCTURED succeeds", async () => {
    await financeService.putFinance(dealerAId, userAId, testData.dealAId, {
      financingMode: "FINANCE",
      termMonths: 60,
      aprBps: 1200,
      cashDownCents: BigInt(0),
    });
    const updated = await financeService.patchFinanceStatus(
      dealerAId,
      userAId,
      testData.dealAId,
      "STRUCTURED"
    );
    expect(updated.status).toBe("STRUCTURED");
  });

  it("invalid transition STRUCTURED -> ACCEPTED returns VALIDATION_ERROR", async () => {
    await expect(
      financeService.patchFinanceStatus(dealerAId, userAId, testData.dealAId, "ACCEPTED")
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("Finance-shell product inclusion recalculation", () => {
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("adding product with includedInAmountFinanced updates finance totals", async () => {
    const before = await financeDb.getFinanceByDealId(testData.dealBId, dealerBId);
    expect(before).not.toBeNull();
    const beforeProductsTotal = before!.productsTotalCents;
    const beforeAmountFinanced = before!.amountFinancedCents;

    const { finance: after } = await financeService.addProduct(
      dealerBId,
      userAId,
      testData.dealBId,
      {
        productType: "GAP",
        name: "GAP Waiver",
        priceCents: BigInt(50000),
        costCents: BigInt(20000),
        includedInAmountFinanced: true,
      }
    );
    expect(after).not.toBeNull();
    expect(after!.productsTotalCents).toBe(beforeProductsTotal + BigInt(50000));
    expect(Number(after!.amountFinancedCents)).toBeGreaterThanOrEqual(
      Number(beforeAmountFinanced)
    );
  });

  it("includedInAmountFinanced=false does not add to productsTotalCents or amountFinanced", async () => {
    const before = await financeDb.getFinanceByDealId(testData.dealBId, dealerBId);
    const { product } = await financeService.addProduct(
      dealerBId,
      userAId,
      testData.dealBId,
      {
        productType: "VSC",
        name: "VSC Not Included",
        priceCents: BigInt(100000),
        includedInAmountFinanced: false,
      }
    );
    const list = await financeService.listProducts(dealerBId, testData.dealBId, {
      limit: 100,
      offset: 0,
    });
    expect(list).not.toBeNull();
    const found = list!.data.find((p) => p.id === product.id);
    expect(found?.includedInAmountFinanced).toBe(false);
    const after = await financeDb.getFinanceByDealId(testData.dealBId, dealerBId);
    expect(after).not.toBeNull();
    expect(after!.productsTotalCents).toBe(before!.productsTotalCents);
    expect(after!.amountFinancedCents).toBe(before!.amountFinancedCents);
  });

  it("toggling includedInAmountFinanced recalculates totals", async () => {
    const { product } = await financeService.addProduct(
      dealerBId,
      userAId,
      testData.dealBId,
      {
        productType: "OTHER",
        name: "Other Product",
        priceCents: BigInt(25000),
        includedInAmountFinanced: true,
      }
    );
    const before = await financeDb.getFinanceByDealId(testData.dealBId, dealerBId);
    await financeService.updateProduct(
      dealerBId,
      userAId,
      testData.dealBId,
      product.id,
      { includedInAmountFinanced: false }
    );
    const after = await financeDb.getFinanceByDealId(testData.dealBId, dealerBId);
    expect(after!.productsTotalCents).toBe(
      before!.productsTotalCents - BigInt(25000)
    );
  });
});

describe("Finance-shell soft delete behavior", () => {
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("deleted product is not returned in GET products", async () => {
    const { product } = await financeService.addProduct(
      dealerBId,
      userAId,
      testData.dealBId,
      {
        productType: "MAINTENANCE",
        name: "To Delete",
        priceCents: BigInt(75000),
        includedInAmountFinanced: true,
      }
    );
    let list = await financeService.listProducts(dealerBId, testData.dealBId, {
      limit: 100,
      offset: 0,
    });
    expect(list!.data.some((p) => p.id === product.id)).toBe(true);
    await financeService.deleteProduct(dealerBId, userAId, testData.dealBId, product.id);
    list = await financeService.listProducts(dealerBId, testData.dealBId, {
      limit: 100,
      offset: 0,
    });
    expect(list!.data.some((p) => p.id === product.id)).toBe(false);
  });

  it("deleting product twice returns NOT_FOUND", async () => {
    const { product } = await financeService.addProduct(
      dealerBId,
      userAId,
      testData.dealBId,
      {
        productType: "TIRE_WHEEL",
        name: "Tire",
        priceCents: BigInt(50000),
        includedInAmountFinanced: false,
      }
    );
    await financeService.deleteProduct(dealerBId, userAId, testData.dealBId, product.id);
    await expect(
      financeService.deleteProduct(dealerBId, userAId, testData.dealBId, product.id)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("totals recalculated after product delete", async () => {
    const { product } = await financeService.addProduct(
      dealerBId,
      userAId,
      testData.dealBId,
      {
        productType: "GAP",
        name: "Recalc GAP",
        priceCents: BigInt(30000),
        includedInAmountFinanced: true,
      }
    );
    const before = await financeDb.getFinanceByDealId(testData.dealBId, dealerBId);
    await financeService.deleteProduct(dealerBId, userAId, testData.dealBId, product.id);
    const after = await financeDb.getFinanceByDealId(testData.dealBId, dealerBId);
    expect(after!.productsTotalCents).toBe(
      before!.productsTotalCents - BigInt(30000)
    );
  });
});

describe("Finance-shell audit events", () => {
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("putFinance (create) writes audit log finance.created", async () => {
    const dealId = randomUUID();
    const customer = await prisma.customer.findFirst({
      where: { dealershipId: dealerAId },
    });
    const auditVehicleId = randomUUID();
    await prisma.vehicle.create({
      data: {
        id: auditVehicleId,
        dealershipId: dealerAId,
        stockNumber: `FA-${auditVehicleId.slice(0, 8)}`,
        status: "AVAILABLE",
      },
    });
    if (!customer) return;
    await prisma.deal.upsert({
      where: { id: dealId },
      create: {
        id: dealId,
        dealershipId: dealerAId,
        customerId: customer.id,
        vehicleId: auditVehicleId,
        salePriceCents: BigInt(500000),
        purchasePriceCents: BigInt(400000),
        taxRateBps: 700,
        taxCents: BigInt(3500),
        docFeeCents: BigInt(0),
        downPaymentCents: BigInt(0),
        totalFeesCents: BigInt(0),
        totalDueCents: BigInt(503500),
        frontGrossCents: BigInt(100000),
        status: "DRAFT",
      },
      update: {},
    });
    await financeService.putFinance(dealerAId, userAId, dealId, {
      financingMode: "CASH",
      cashDownCents: BigInt(0),
    });
    const logs = await prisma.auditLog.findMany({
      where: {
        dealershipId: dealerAId,
        action: "finance.created",
        entity: "DealFinance",
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].metadata).toMatchObject(
      expect.objectContaining({ dealId, dealFinanceId: expect.any(String) })
    );
  });

  it("patchFinanceStatus writes audit log finance.status_changed", async () => {
    await financeService.patchFinanceStatus(dealerBId, userAId, testData.dealBId, "STRUCTURED");
    const logs = await prisma.auditLog.findMany({
      where: {
        dealershipId: dealerBId,
        action: "finance.status_changed",
        entity: "DealFinance",
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].metadata).toMatchObject(
      expect.objectContaining({
        dealId: testData.dealBId,
        fromStatus: "DRAFT",
        toStatus: "STRUCTURED",
      })
    );
  });

  it("addProduct writes audit log finance.product_added", async () => {
    const { product } = await financeService.addProduct(
      dealerBId,
      userAId,
      testData.dealBId,
      {
        productType: "VSC",
        name: "5yr VSC",
        priceCents: BigInt(150000),
        includedInAmountFinanced: false,
      }
    );
    const logs = await prisma.auditLog.findMany({
      where: {
        dealershipId: dealerBId,
        action: "finance.product_added",
        entity: "DealFinanceProduct",
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].metadata).toMatchObject(
      expect.objectContaining({ dealId: testData.dealBId, productId: product.id })
    );
  });
});
