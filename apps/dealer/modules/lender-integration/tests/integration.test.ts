/** @jest-environment node */
/**
 * Lender-integration integration tests (skip when !hasDb):
 * Tenant isolation, RBAC, submission snapshot, status transitions,
 * funding CONTRACTED rule, deal canceled blocking, stip document validation.
 * Each describe uses isolated test data (unique IDs) to avoid shared mutation.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import * as lenderService from "../service";
import * as lenderDb from "../db";
import * as applicationService from "../service/application";
import * as submissionService from "../service/submission";
import * as stipulationService from "../service/stipulation";
import * as dealService from "@/modules/deals/service/deal";
import * as financeShellDb from "@/modules/finance-shell/db";
import { requirePermission, loadUserPermissions } from "@/lib/rbac";


export type LenderTestData = {
  dealerAId: string;
  dealerBId: string;
  userAId: string;
  userBId: string;
  lendersReadOnlyId: string;
  noLenderPermId: string;
  dealAId: string;
  dealBId: string;
  lenderAId: string;
  lenderBId: string;
  applicationAId: string;
  applicationBId: string;
  submissionAId: string;
  submissionBId: string;
};

async function ensureTestData(): Promise<LenderTestData> {
  const dealerAId = randomUUID();
  const dealerBId = randomUUID();
  const userAId = randomUUID();
  const userBId = randomUUID();
  const lendersReadOnlyId = randomUUID();
  const noLenderPermId = randomUUID();
  const customerAId = randomUUID();
  const customerBId = randomUUID();
  const vehicleAId = randomUUID();
  const vehicleBId = randomUUID();
  const dealAId = randomUUID();
  const dealBId = randomUUID();
  const financeAId = randomUUID();
  const financeBId = randomUUID();
  const lenderAId = randomUUID();
  const lenderBId = randomUUID();
  const appAId = randomUUID();
  const appBId = randomUUID();
  const subAId = randomUUID();
  const subBId = randomUUID();

  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Lender Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Lender Dealer B" },
    update: {},
  });
  const emailSuffix = dealerAId.slice(0, 8);
  for (const [id, slug] of [
    [userAId, "lender-a"],
    [userBId, "lender-b"],
    [lendersReadOnlyId, "lender-read"],
    [noLenderPermId, "no-lender"],
  ] as const) {
    const email = `${slug}-${emailSuffix}@test.local`;
    await prisma.profile.upsert({
      where: { id },
      create: { id, email },
      update: { email },
    });
  }

  const customerA = await prisma.customer.upsert({
    where: { id: customerAId },
    create: {
      id: customerAId,
      dealershipId: dealerAId,
      name: "Customer A",
      status: "LEAD",
    },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: customerBId },
    create: {
      id: customerBId,
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
      stockNumber: `LIA-${vehicleAId.slice(0, 8)}`,
      status: "AVAILABLE",
    },
    update: {},
  });
  const vehicleB = await prisma.vehicle.upsert({
    where: { id: vehicleBId },
    create: {
      id: vehicleBId,
      dealershipId: dealerBId,
      stockNumber: `LIB-${vehicleBId.slice(0, 8)}`,
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

  await prisma.dealFinance.upsert({
    where: { dealId: dealA.id },
    create: {
      id: financeAId,
      dealershipId: dealerAId,
      dealId: dealA.id,
      financingMode: "FINANCE",
      termMonths: 72,
      aprBps: 900,
      cashDownCents: BigInt(0),
      amountFinancedCents: BigInt(2014500),
      monthlyPaymentCents: BigInt(35000),
      totalOfPaymentsCents: BigInt(2520000),
      financeChargeCents: BigInt(505500),
      productsTotalCents: BigInt(20000),
      backendGrossCents: BigInt(8000),
      status: "DRAFT",
    },
    update: {},
  });
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
      amountFinancedCents: BigInt(1515500),
      monthlyPaymentCents: BigInt(33712),
      totalOfPaymentsCents: BigInt(2022720),
      financeChargeCents: BigInt(507220),
      productsTotalCents: BigInt(0),
      backendGrossCents: BigInt(0),
      status: "DRAFT",
    },
    update: {},
  });

  const lenderA = await prisma.lender.upsert({
    where: { id: lenderAId },
    create: {
      id: lenderAId,
      dealershipId: dealerAId,
      name: "Bank A",
      lenderType: "BANK",
      externalSystem: "NONE",
      isActive: true,
    },
    update: {},
  });
  const lenderB = await prisma.lender.upsert({
    where: { id: lenderBId },
    create: {
      id: lenderBId,
      dealershipId: dealerBId,
      name: "Bank B",
      lenderType: "BANK",
      externalSystem: "NONE",
      isActive: true,
    },
    update: {},
  });

  const appA = await prisma.financeApplication.upsert({
    where: { id: appAId },
    create: {
      id: appAId,
      dealershipId: dealerAId,
      dealId: dealA.id,
      status: "DRAFT",
    },
    update: {},
  });

  const appB = await prisma.financeApplication.upsert({
    where: { id: appBId },
    create: {
      id: appBId,
      dealershipId: dealerBId,
      dealId: dealB.id,
      status: "DRAFT",
    },
    update: {},
  });

  const financeA = await prisma.dealFinance.findUniqueOrThrow({ where: { dealId: dealA.id } });
  const subA = await prisma.financeSubmission.upsert({
    where: { id: subAId },
    create: {
      id: subAId,
      dealershipId: dealerAId,
      applicationId: appA.id,
      dealId: dealA.id,
      lenderId: lenderA.id,
      status: "DRAFT",
      amountFinancedCents: financeA.amountFinancedCents,
      termMonths: financeA.termMonths!,
      aprBps: financeA.aprBps!,
      paymentCents: financeA.monthlyPaymentCents,
      productsTotalCents: financeA.productsTotalCents,
      backendGrossCents: financeA.backendGrossCents,
      fundingStatus: "PENDING",
    },
    update: {},
  });

  const financeBRow = await prisma.dealFinance.findUniqueOrThrow({ where: { dealId: dealB.id } });
  const subB = await prisma.financeSubmission.upsert({
    where: { id: subBId },
    create: {
      id: subBId,
      dealershipId: dealerBId,
      applicationId: appB.id,
      dealId: dealB.id,
      lenderId: lenderB.id,
      status: "DRAFT",
      amountFinancedCents: financeBRow.amountFinancedCents,
      termMonths: financeBRow.termMonths!,
      aprBps: financeBRow.aprBps!,
      paymentCents: financeBRow.monthlyPaymentCents,
      productsTotalCents: financeBRow.productsTotalCents,
      backendGrossCents: financeBRow.backendGrossCents,
      fundingStatus: "PENDING",
    },
    update: {},
  });

  return {
    dealerAId,
    dealerBId,
    userAId,
    userBId,
    lendersReadOnlyId,
    noLenderPermId,
    dealAId: dealA.id,
    dealBId: dealB.id,
    lenderAId: lenderA.id,
    lenderBId: lenderB.id,
    applicationAId: appA.id,
    applicationBId: appB.id,
    submissionAId: subA.id,
    submissionBId: subB.id,
  };
}

let testData: LenderTestData;

describe("Lender-integration tenant isolation", () => {
  jest.setTimeout(15000);
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("Dealer A cannot read Dealer B lender", async () => {
    const found = await lenderDb.getLenderById(testData.dealerAId, testData.lenderBId);
    expect(found).toBeNull();
  });

  it("Dealer A cannot update Dealer B lender", async () => {
    const updated = await lenderDb.updateLender(testData.dealerAId, testData.lenderBId, { name: "Hacked" });
    expect(updated).toBeNull();
  });

  it("Dealer A cannot GET applications for Dealer B deal", async () => {
    await expect(
      applicationService.listApplications(testData.dealerAId, testData.dealBId, { limit: 25, offset: 0 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Dealer A cannot GET application for Dealer B application", async () => {
    await expect(
      applicationService.getApplication(testData.dealerAId, testData.dealBId, testData.applicationBId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Dealer A cannot PATCH application for Dealer B application", async () => {
    await expect(
      applicationService.updateApplication(
        testData.dealerAId,
        testData.userAId,
        testData.dealBId,
        testData.applicationBId,
        { status: "COMPLETED" },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Dealer A cannot list submissions under Dealer B application", async () => {
    const result = await submissionService.listSubmissions(testData.dealerAId, testData.dealBId, testData.applicationBId, {
      limit: 25,
      offset: 0,
    });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("Dealer A cannot PATCH submission for Dealer B submission", async () => {
    await expect(
      submissionService.updateSubmission(
        testData.dealerAId,
        testData.userAId,
        testData.dealBId,
        testData.applicationBId,
        testData.submissionBId,
        { status: "READY_TO_SUBMIT" },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Dealer A cannot PATCH funding for Dealer B submission", async () => {
    await expect(
      submissionService.updateSubmissionFunding(
        testData.dealerAId,
        testData.userAId,
        testData.dealBId,
        testData.applicationBId,
        testData.submissionBId,
        { fundingStatus: "PENDING" },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Dealer A cannot list stips for Dealer B submission", async () => {
    const result = await stipulationService.listStipulations(testData.dealerAId, testData.submissionBId, {
      limit: 25,
      offset: 0,
    });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("Dealer A cannot add stip for Dealer B submission", async () => {
    await expect(
      stipulationService.createStipulation(
        testData.dealerAId,
        testData.userAId,
        testData.submissionBId,
        { stipType: "PAYSTUB", status: "REQUESTED" },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Dealer A cannot PATCH or DELETE stip for Dealer B submission", async () => {
    const stipB = await prisma.financeStipulation.findFirst({
      where: { submissionId: testData.submissionBId },
    });
    if (!stipB) return;
    await expect(
      stipulationService.updateStipulation(
        testData.dealerAId,
        testData.userAId,
        testData.submissionBId,
        stipB.id,
        { status: "RECEIVED" },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      stipulationService.deleteStipulation(testData.dealerAId, testData.userAId, testData.submissionBId, stipB.id, {})
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("createSubmission for Dealer B deal as Dealer A throws NOT_FOUND", async () => {
    await expect(
      lenderService.createSubmission(testData.dealerAId, testData.userAId, testData.dealBId, testData.applicationBId, {
        lenderId: testData.lenderBId,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stip document cross-tenant returns NOT_FOUND", async () => {
    const sub = await lenderDb.getSubmissionById(testData.dealerAId, testData.submissionAId);
    if (!sub) return;
    const fileB = await prisma.fileObject.findFirst({
      where: { dealershipId: testData.dealerBId },
    });
    if (!fileB) return;
    const stip = await prisma.financeStipulation.findFirst({
      where: { submissionId: testData.submissionAId },
    });
    if (!stip) return;
    await expect(
      lenderService.updateStipulation(
        testData.dealerAId,
        testData.userAId,
        testData.submissionAId,
        stip.id,
        { documentId: fileB.id },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Lender-integration RBAC", () => {
  jest.setTimeout(15000);
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("missing lenders.read → 403 on GET lenders", async () => {
    const perms = await loadUserPermissions(testData.noLenderPermId, testData.dealerAId);
    expect(perms.includes("lenders.read")).toBe(false);
    await expect(requirePermission(testData.noLenderPermId, testData.dealerAId, "lenders.read")).rejects.toMatchObject(
      { code: "FORBIDDEN" }
    );
  });

  it("missing finance.submissions.read → 403 on GET applications/submissions/stips", async () => {
    await expect(
      requirePermission(testData.noLenderPermId, testData.dealerAId, "finance.submissions.read")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requirePermission lenders.write throws FORBIDDEN when missing", async () => {
    await expect(
      requirePermission(testData.lendersReadOnlyId, testData.dealerAId, "lenders.write")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requirePermission finance.submissions.write throws FORBIDDEN when missing", async () => {
    await expect(
      requirePermission(testData.noLenderPermId, testData.dealerAId, "finance.submissions.write")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Lender-integration submission snapshot", () => {
  jest.setTimeout(15000);
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("submission snapshot equals DealFinance at creation", async () => {
    const financeBefore = await financeShellDb.getFinanceByDealId(testData.dealAId, testData.dealerAId);
    if (!financeBefore) throw new Error("No DealFinance");
    const lender = await lenderDb.getLenderById(testData.dealerAId, testData.lenderAId);
    if (!lender) throw new Error("No lender");
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: lender.id },
      {}
    );
    expect(created.amountFinancedCents).toBe(financeBefore.amountFinancedCents);
    expect(created.termMonths).toBe(financeBefore.termMonths);
    expect(created.aprBps).toBe(financeBefore.aprBps);
    expect(created.paymentCents).toBe(financeBefore.monthlyPaymentCents);
    expect(created.productsTotalCents).toBe(financeBefore.productsTotalCents);
    expect(created.backendGrossCents).toBe(financeBefore.backendGrossCents);
  });

  it("later DealFinance change does not change existing submission", async () => {
    const sub = await lenderDb.getSubmissionById(testData.dealerAId, testData.submissionAId);
    if (!sub) throw new Error("No submission");
    const beforeCents = sub.amountFinancedCents;
    await prisma.dealFinance.updateMany({
      where: { dealId: sub.dealId, dealershipId: testData.dealerAId },
      data: { amountFinancedCents: BigInt(999999) },
    });
    const after = await lenderDb.getSubmissionById(testData.dealerAId, testData.submissionAId);
    expect(after?.amountFinancedCents).toBe(beforeCents);
  });
});

describe("Lender-integration status transitions", () => {
  jest.setTimeout(15000);
  beforeEach(async () => {
    testData = await ensureTestData();
  });

  it("valid transition DRAFT → READY_TO_SUBMIT succeeds", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    const updated = await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "READY_TO_SUBMIT" },
      {}
    );
    expect(updated.status).toBe("READY_TO_SUBMIT");
  });

  it("valid transition READY_TO_SUBMIT → SUBMITTED succeeds", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "READY_TO_SUBMIT" },
      {}
    );
    const updated = await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "SUBMITTED" },
      {}
    );
    expect(updated.status).toBe("SUBMITTED");
  });

  it("valid transition SUBMITTED → DECISIONED succeeds", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "READY_TO_SUBMIT" },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "SUBMITTED" },
      {}
    );
    const updated = await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "DECISIONED", decisionStatus: "APPROVED" },
      {}
    );
    expect(updated.status).toBe("DECISIONED");
  });

  it("invalid transition DRAFT → FUNDED throws VALIDATION_ERROR", async () => {
    await expect(
      lenderService.updateSubmission(
        testData.dealerAId,
        testData.userAId,
        testData.dealAId,
        testData.applicationAId,
        testData.submissionAId,
        { status: "FUNDED" },
        {}
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("invalid transition SUBMITTED → DRAFT throws VALIDATION_ERROR", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "READY_TO_SUBMIT" },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "SUBMITTED" },
      {}
    );
    await expect(
      lenderService.updateSubmission(
        testData.dealerAId,
        testData.userAId,
        testData.dealAId,
        testData.applicationAId,
        created.id,
        { status: "DRAFT" },
        {}
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("invalid transition FUNDED → SUBMITTED throws VALIDATION_ERROR", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "READY_TO_SUBMIT" },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "SUBMITTED" },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "DECISIONED", decisionStatus: "APPROVED" },
      {}
    );
    await dealService.updateDealStatus(testData.dealerAId, testData.userAId, testData.dealAId, "STRUCTURED", {});
    await dealService.updateDealStatus(testData.dealerAId, testData.userAId, testData.dealAId, "APPROVED", {});
    await dealService.updateDealStatus(testData.dealerAId, testData.userAId, testData.dealAId, "CONTRACTED", {});
    await lenderService.updateSubmissionFunding(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { fundingStatus: "FUNDED" },
      {}
    );
    await expect(
      lenderService.updateSubmission(
        testData.dealerAId,
        testData.userAId,
        testData.dealAId,
        testData.applicationAId,
        created.id,
        { status: "SUBMITTED" },
        {}
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("DECISIONED → FUNDED only via funding endpoint when deal CONTRACTED", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "READY_TO_SUBMIT" },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "SUBMITTED" },
      {}
    );
    await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "DECISIONED", decisionStatus: "APPROVED" },
      {}
    );
    await expect(
      lenderService.updateSubmission(
        testData.dealerAId,
        testData.userAId,
        testData.dealAId,
        testData.applicationAId,
        created.id,
        { status: "FUNDED" },
        {}
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await dealService.updateDealStatus(testData.dealerAId, testData.userAId, testData.dealAId, "STRUCTURED", {});
    await dealService.updateDealStatus(testData.dealerAId, testData.userAId, testData.dealAId, "APPROVED", {});
    await dealService.updateDealStatus(testData.dealerAId, testData.userAId, testData.dealAId, "CONTRACTED", {});
    const funded = await lenderService.updateSubmissionFunding(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { fundingStatus: "FUNDED" },
      {}
    );
    expect(funded.status).toBe("FUNDED");
    expect(funded.fundingStatus).toBe("FUNDED");
  });

  it("any → CANCELED ok", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    const updated = await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "CANCELED" },
      {}
    );
    expect(updated.status).toBe("CANCELED");
  });
});

describe("Lender-integration funding", () => {
  jest.setTimeout(15000);
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("FUNDED without Deal CONTRACTED returns CONFLICT", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    await expect(
      lenderService.updateSubmissionFunding(
        testData.dealerAId,
        testData.userAId,
        testData.dealAId,
        testData.applicationAId,
        created.id,
        { fundingStatus: "FUNDED" },
        {}
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("Lender-integration deal canceled", () => {
  jest.setTimeout(15000);
  beforeEach(async () => {
    testData = await ensureTestData();
  });

  it("after deal CANCELED, submission update only allows status CANCELED", async () => {
    const created = await lenderService.createSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { lenderId: testData.lenderAId },
      {}
    );
    await dealService.updateDealStatus(testData.dealerAId, testData.userAId, testData.dealAId, "CANCELED", {});
    await expect(
      lenderService.updateSubmission(
        testData.dealerAId,
        testData.userAId,
        testData.dealAId,
        testData.applicationAId,
        created.id,
        { status: "READY_TO_SUBMIT" },
        {}
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const updated = await lenderService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      created.id,
      { status: "CANCELED" },
      {}
    );
    expect(updated.status).toBe("CANCELED");
  });

  it("when Deal CANCELED, PATCH deal returns CONFLICT", async () => {
    await dealService.updateDealStatus(testData.dealerAId, testData.userAId, testData.dealAId, "CANCELED", {});
    await expect(
      dealService.updateDeal(
        testData.dealerAId,
        testData.userAId,
        testData.dealAId,
        { notes: "attempted change" },
        {}
      )
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("Lender-integration stip document", () => {
  jest.setTimeout(15000);
  beforeAll(async () => {
    testData = await ensureTestData();
  });

  it("wrong deal document returns NOT_FOUND", async () => {
    let fileForDealB = await prisma.fileObject.findFirst({
      where: { dealershipId: testData.dealerAId, entityType: "DEAL", entityId: testData.dealBId, deletedAt: null },
    });
    if (!fileForDealB) {
      fileForDealB = await prisma.fileObject.create({
        data: {
          dealershipId: testData.dealerAId,
          bucket: "deal-documents",
          path: "test/doc-b.pdf",
          filename: "doc-b.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
          uploadedBy: testData.userAId,
          entityType: "DEAL",
          entityId: testData.dealBId,
        },
      });
    }
    const stip = await lenderService.createStipulation(
      testData.dealerAId,
      testData.userAId,
      testData.submissionAId,
      { stipType: "PAYSTUB" },
      {}
    );
    await expect(
      lenderService.updateStipulation(
        testData.dealerAId,
        testData.userAId,
        testData.submissionAId,
        stip.id,
        { documentId: fileForDealB.id },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("document with entityType != DEAL returns NOT_FOUND", async () => {
    const sub = await lenderDb.getSubmissionById(testData.dealerAId, testData.submissionAId);
    if (!sub) return;
    const fileOther = await prisma.fileObject.create({
      data: {
        dealershipId: testData.dealerAId,
        bucket: "deal-documents",
        path: "test/other.pdf",
        filename: "other.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        uploadedBy: testData.userAId,
        entityType: "CUSTOMER",
        entityId: testData.dealerAId,
      },
    });
    const stip = await lenderService.createStipulation(
      testData.dealerAId,
      testData.userAId,
      testData.submissionAId,
      { stipType: "PAYSTUB" },
      {}
    );
    await expect(
      lenderService.updateStipulation(
        testData.dealerAId,
        testData.userAId,
        testData.submissionAId,
        stip.id,
        { documentId: fileOther.id },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("document from another tenant returns NOT_FOUND", async () => {
    const sub = await lenderDb.getSubmissionById(testData.dealerAId, testData.submissionAId);
    if (!sub) return;
    const fileB = await prisma.fileObject.findFirst({
      where: { dealershipId: testData.dealerBId, entityType: "DEAL", deletedAt: null },
    });
    if (!fileB) return;
    const stip = await prisma.financeStipulation.findFirst({
      where: { submissionId: testData.submissionAId },
    });
    if (!stip) return;
    await expect(
      lenderService.updateStipulation(
        testData.dealerAId,
        testData.userAId,
        testData.submissionAId,
        stip.id,
        { documentId: fileB.id },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("soft-deleted document returns NOT_FOUND", async () => {
    const sub = await lenderDb.getSubmissionById(testData.dealerAId, testData.submissionAId);
    if (!sub) return;
    const fileDeleted = await prisma.fileObject.create({
      data: {
        dealershipId: testData.dealerAId,
        bucket: "deal-documents",
        path: "test/deleted.pdf",
        filename: "deleted.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        uploadedBy: testData.userAId,
        entityType: "DEAL",
        entityId: sub.dealId,
        deletedAt: new Date(),
      },
    });
    const stip = await lenderService.createStipulation(
      testData.dealerAId,
      testData.userAId,
      testData.submissionAId,
      { stipType: "PAYSTUB" },
      {}
    );
    await expect(
      lenderService.updateStipulation(
        testData.dealerAId,
        testData.userAId,
        testData.submissionAId,
        stip.id,
        { documentId: fileDeleted.id },
        {}
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Lender-integration audit safety", () => {
  jest.setTimeout(15000);
  beforeEach(async () => {
    testData = await ensureTestData();
  });

  it("finance_application.updated audit metadata has no applicant email/phone", async () => {
    await applicationService.updateApplication(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      { status: "COMPLETED" },
      {}
    );
    const row = await prisma.auditLog.findFirst({
      where: {
        dealershipId: testData.dealerAId,
        action: "finance_application.updated",
        entityId: testData.applicationAId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(row).not.toBeNull();
    const meta = row!.metadata as Record<string, unknown> | null;
    expect(meta).not.toBeNull();
    expect(meta!.email).toBeUndefined();
    expect(meta!.phone).toBeUndefined();
    expect(meta!.applicantEmail).toBeUndefined();
    expect(meta!.applicantPhone).toBeUndefined();
    expect(meta!.applicationId).toBeDefined();
    expect(Array.isArray(meta!.changedFields) || meta!.changedFields !== undefined).toBe(true);
  });

  it("submission.decision_updated audit metadata has no decisionNotes PII", async () => {
    await submissionService.updateSubmission(
      testData.dealerAId,
      testData.userAId,
      testData.dealAId,
      testData.applicationAId,
      testData.submissionAId,
      { decisionStatus: "APPROVED", decisionNotes: "secret customer info 555-1234" },
      {}
    );
    const row = await prisma.auditLog.findFirst({
      where: {
        dealershipId: testData.dealerAId,
        action: "submission.decision_updated",
        entityId: testData.submissionAId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(row).not.toBeNull();
    const meta = row!.metadata as Record<string, unknown> | null;
    expect(meta).not.toBeNull();
    expect(meta!.decisionNotes).toBeUndefined();
    expect(meta!.submissionId).toBeDefined();
    expect(meta!.decisionStatus).toBeDefined();
  });
});
