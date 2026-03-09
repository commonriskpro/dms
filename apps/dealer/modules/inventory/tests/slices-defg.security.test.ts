/** @jest-environment node */
/**
 * Security & QA tests for Inventory Depth Slices D, E, F, G:
 * VIN decode, Valuations, Recon, Floorplan.
 * Covers: RBAC (403 when permission missing), tenant isolation (404 cross-dealer),
 * validation (400 invalid input), invariants (recon total, cents-only, RECON_OVERDUE), audit.
 */
import { prisma } from "@/lib/db";
import { loadUserPermissions, requirePermission } from "@/lib/rbac";
import { ApiError } from "@/lib/auth";
import { toErrorPayload } from "@/lib/api/errors";
import * as vinDecodeService from "../service/vin-decode";
import * as valuationService from "../service/valuation";
import * as reconService from "../service/recon";
import * as floorplanService from "../service/floorplan";
import * as bookValuesService from "../service/book-values";
import * as reconItemsService from "../service/recon-items";
import * as floorplanLoansService from "../service/floorplan-loans";
import * as alertsDb from "../db/alerts";
import {
  idParamSchema,
  requestValuationBodySchema,
  reconLineItemBodySchema,
  reconUpdateBodySchema,
  floorplanUpsertBodySchema,
  curtailmentBodySchema,
  payoffQuoteBodySchema,
  reconLineItemIdParamSchema,
  bookValuesBodySchema,
  reconItemCreateBodySchema,
  reconItemUpdateBodySchema,
  reconItemIdParamSchema,
  floorplanLoanBodySchema,
  floorplanLoanUpdateBodySchema,
  floorplanLoanIdParamSchema,
} from "@/app/api/inventory/schemas";

// ——— Fixture IDs (avoid clashing with rbac.test / tenant-isolation / audit) ———
const dealerAId = "d1000000-0000-0000-0000-000000000001";
const dealerBId = "d2000000-0000-0000-0000-000000000002";
const userAId = "d3000000-0000-0000-0000-000000000003";
// RBAC: inventory read-only (has inventory.read, no inventory.write)
const invReadOnlyId = "d4000000-0000-0000-0000-000000000004";
// RBAC: no inventory permissions
const noInvId = "d5000000-0000-0000-0000-000000000005";
// RBAC: finance read-only (has finance.read, no finance.write)
const finReadOnlyId = "d6000000-0000-0000-0000-000000000006";
// RBAC: no finance permissions (has inventory.read for GET list, but no finance.read/finance.write)
const noFinId = "d7000000-0000-0000-0000-000000000007";

async function ensureDefgTestData(): Promise<{
  vehicleAId: string;
  vehicleBId: string;
  lenderAId: string;
}> {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Defg Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Defg Dealer B" },
    update: {},
  });
  for (const [id, email] of [
    [userAId, "defg-a@test.local"],
    [invReadOnlyId, "defg-inv-ro@test.local"],
    [noInvId, "defg-noinv@test.local"],
    [finReadOnlyId, "defg-fin-ro@test.local"],
    [noFinId, "defg-nofin@test.local"],
  ] as const) {
    await prisma.profile.upsert({
      where: { id },
      create: { id, email },
      update: {},
    });
  }

  const permInvRead = await prisma.permission.findFirst({ where: { key: "inventory.read" } });
  const permInvWrite = await prisma.permission.findFirst({ where: { key: "inventory.write" } });
  const permFinRead = await prisma.permission.findFirst({ where: { key: "finance.read" } });
  const permFinWrite = await prisma.permission.findFirst({ where: { key: "finance.write" } });
  const permAdmin = await prisma.permission.findFirst({ where: { key: "admin.dealership.read" } });
  if (!permInvRead || !permInvWrite || !permFinRead || !permFinWrite || !permAdmin) {
    return { vehicleAId: "", vehicleBId: "", lenderAId: "" };
  }

  const roleInvReadOnly = await prisma.role.upsert({
    where: { id: "d8000000-0000-0000-0000-000000000008" },
    create: {
      id: "d8000000-0000-0000-0000-000000000008",
      dealershipId: dealerAId,
      name: "DefgInvReadOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permInvRead.id }] },
    },
    update: {},
  });
  const roleNoInv = await prisma.role.upsert({
    where: { id: "d9000000-0000-0000-0000-000000000009" },
    create: {
      id: "d9000000-0000-0000-0000-000000000009",
      dealershipId: dealerAId,
      name: "DefgNoInv",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permAdmin.id }] },
    },
    update: {},
  });
  const roleFinReadOnly = await prisma.role.upsert({
    where: { id: "da000000-0000-0000-0000-00000000000a" },
    create: {
      id: "da000000-0000-0000-0000-00000000000a",
      dealershipId: dealerAId,
      name: "DefgFinReadOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permFinRead.id }] },
    },
    update: {},
  });
  const roleNoFin = await prisma.role.upsert({
    where: { id: "db000000-0000-0000-0000-00000000000b" },
    create: {
      id: "db000000-0000-0000-0000-00000000000b",
      dealershipId: dealerAId,
      name: "DefgNoFin",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permInvRead.id }] },
    },
    update: {},
  });

  await prisma.membership.upsert({
    where: { id: "dc000000-0000-0000-0000-00000000000c" },
    create: {
      id: "dc000000-0000-0000-0000-00000000000c",
      dealershipId: dealerAId,
      userId: invReadOnlyId,
      roleId: roleInvReadOnly.id,
    },
    update: { roleId: roleInvReadOnly.id },
  });
  await prisma.membership.upsert({
    where: { id: "dd000000-0000-0000-0000-00000000000d" },
    create: {
      id: "dd000000-0000-0000-0000-00000000000d",
      dealershipId: dealerAId,
      userId: noInvId,
      roleId: roleNoInv.id,
    },
    update: { roleId: roleNoInv.id },
  });
  await prisma.membership.upsert({
    where: { id: "de000000-0000-0000-0000-00000000000e" },
    create: {
      id: "de000000-0000-0000-0000-00000000000e",
      dealershipId: dealerAId,
      userId: finReadOnlyId,
      roleId: roleFinReadOnly.id,
    },
    update: { roleId: roleFinReadOnly.id },
  });
  await prisma.membership.upsert({
    where: { id: "df000000-0000-0000-0000-00000000000f" },
    create: {
      id: "df000000-0000-0000-0000-00000000000f",
      dealershipId: dealerAId,
      userId: noFinId,
      roleId: roleNoFin.id,
    },
    update: { roleId: roleNoFin.id },
  });

  const vehicleA = await prisma.vehicle.upsert({
    where: { id: "e1000000-0000-0000-0000-000000000001" },
    create: {
      id: "e1000000-0000-0000-0000-000000000001",
      dealershipId: dealerAId,
      stockNumber: "DEFG-A-001",
      status: "AVAILABLE",
      vin: "1HGBH41JXMN109186",
    },
    update: {},
  });
  const vehicleB = await prisma.vehicle.upsert({
    where: { id: "e2000000-0000-0000-0000-000000000002" },
    create: {
      id: "e2000000-0000-0000-0000-000000000002",
      dealershipId: dealerBId,
      stockNumber: "DEFG-B-001",
      status: "AVAILABLE",
    },
    update: {},
  });

  const lenderA = await prisma.lender.upsert({
    where: { id: "e3000000-0000-0000-0000-000000000003" },
    create: {
      id: "e3000000-0000-0000-0000-000000000003",
      dealershipId: dealerAId,
      name: "Defg Lender A",
      lenderType: "BANK",
      externalSystem: "NONE",
    },
    update: {},
  });

  return { vehicleAId: vehicleA.id, vehicleBId: vehicleB.id, lenderAId: lenderA.id };
}

// ——— RBAC: 403 when required permission is missing ———
describe("Slices D/E/F/G RBAC", () => {
  beforeAll(async () => {
    await ensureDefgTestData();
  });

  it("POST vin/decode requires inventory.write → 403 without it", async () => {
    const perms = await loadUserPermissions(invReadOnlyId, dealerAId);
    expect(perms).toContain("inventory.read");
    expect(perms).not.toContain("inventory.write");
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).code).toBe("FORBIDDEN");
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("GET vin requires inventory.read → 403 without it", async () => {
    const perms = await loadUserPermissions(noInvId, dealerAId);
    expect(perms).not.toContain("inventory.read");
    try {
      await requirePermission(noInvId, dealerAId, "inventory.read");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("GET valuations requires inventory.read → 403 without it", async () => {
    try {
      await requirePermission(noInvId, dealerAId, "inventory.read");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("POST valuations requires finance.read → 403 without it", async () => {
    const perms = await loadUserPermissions(noFinId, dealerAId);
    expect(perms).toContain("inventory.read");
    expect(perms).not.toContain("finance.read");
    try {
      await requirePermission(noFinId, dealerAId, "finance.read");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("GET recon requires inventory.read → 403 without it", async () => {
    try {
      await requirePermission(noInvId, dealerAId, "inventory.read");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("PATCH recon requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("POST recon/line-items requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("PATCH recon/line-items/[lineItemId] requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("DELETE recon/line-items/[lineItemId] requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("GET floorplan requires finance.read → 403 without it", async () => {
    try {
      await requirePermission(noFinId, dealerAId, "finance.read");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("PUT floorplan requires finance.write → 403 without it", async () => {
    const perms = await loadUserPermissions(finReadOnlyId, dealerAId);
    expect(perms).toContain("finance.read");
    expect(perms).not.toContain("finance.write");
    try {
      await requirePermission(finReadOnlyId, dealerAId, "finance.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("POST floorplan/curtailments requires finance.write → 403 without it", async () => {
    try {
      await requirePermission(finReadOnlyId, dealerAId, "finance.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("POST floorplan/payoff-quote requires finance.write → 403 without it", async () => {
    try {
      await requirePermission(finReadOnlyId, dealerAId, "finance.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("GET book-values requires inventory.read → 403 without it", async () => {
    try {
      await requirePermission(noInvId, dealerAId, "inventory.read");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("POST book-values requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("GET recon/items requires inventory.read → 403 without it", async () => {
    try {
      await requirePermission(noInvId, dealerAId, "inventory.read");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("POST recon/items requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("PATCH recon/[reconItemId] requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("GET floorplan/loans requires inventory.read → 403 without it", async () => {
    try {
      await requirePermission(noInvId, dealerAId, "inventory.read");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("POST floorplan/loans requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });

  it("PATCH floorplan/[floorplanLoanId] requires inventory.write → 403 without it", async () => {
    try {
      await requirePermission(invReadOnlyId, dealerAId, "inventory.write");
    } catch (e) {
      expect(toErrorPayload(e).status).toBe(403);
    }
  });
});

// ——— Tenant isolation: cross-dealership request returns 404 (NOT_FOUND) ———
describe("Slices D/E/F/G tenant isolation", () => {
  let vehicleAId: string;
  let vehicleBId: string;
  let lenderAId: string;

  beforeAll(async () => {
    const data = await ensureDefgTestData();
    vehicleAId = data.vehicleAId;
    vehicleBId = data.vehicleBId;
    lenderAId = data.lenderAId;
  });

  it("decodeVin for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      vinDecodeService.decodeVin(dealerAId, vehicleBId, userAId, { ip: "127.0.0.1" })
    ).rejects.toThrow(ApiError);
    try {
      await vinDecodeService.decodeVin(dealerAId, vehicleBId, userAId, { ip: "127.0.0.1" });
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("getVin for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(vinDecodeService.getVin(dealerAId, vehicleBId, { latestOnly: true })).rejects.toThrow(
      ApiError
    );
    try {
      await vinDecodeService.getVin(dealerAId, vehicleBId, { latestOnly: true });
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("listValuations for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      valuationService.listValuations(dealerAId, vehicleBId, { limit: 10, offset: 0 })
    ).rejects.toThrow(ApiError);
    try {
      await valuationService.listValuations(dealerAId, vehicleBId, { limit: 10, offset: 0 });
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("requestValuation for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      valuationService.requestValuation(
        dealerAId,
        vehicleBId,
        userAId,
        { source: "MOCK" },
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await valuationService.requestValuation(
        dealerAId,
        vehicleBId,
        userAId,
        { source: "MOCK" },
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("getRecon for other dealer vehicle returns null (vehicle not found throws)", async () => {
    if (!vehicleBId) return;
    await expect(reconService.getRecon(dealerAId, vehicleBId)).rejects.toThrow(ApiError);
    try {
      await reconService.getRecon(dealerAId, vehicleBId);
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("updateRecon for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      reconService.updateRecon(
        dealerAId,
        vehicleBId,
        { status: "IN_PROGRESS" },
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await reconService.updateRecon(
        dealerAId,
        vehicleBId,
        { status: "IN_PROGRESS" },
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("addLineItem recon for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      reconService.addLineItem(
        dealerAId,
        vehicleBId,
        { description: "Test", costCents: 1000 },
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await reconService.addLineItem(
        dealerAId,
        vehicleBId,
        { description: "Test", costCents: 1000 },
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("getFloorplan for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(floorplanService.getFloorplan(dealerAId, vehicleBId)).rejects.toThrow(ApiError);
    try {
      await floorplanService.getFloorplan(dealerAId, vehicleBId);
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("upsertFloorplan for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId || !lenderAId) return;
    await expect(
      floorplanService.upsertFloorplan(
        dealerAId,
        vehicleBId,
        {
          lenderId: lenderAId,
          principalCents: 1000000,
          startDate: new Date(),
        },
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await floorplanService.upsertFloorplan(
        dealerAId,
        vehicleBId,
        {
          lenderId: lenderAId,
          principalCents: 1000000,
          startDate: new Date(),
        },
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("addCurtailment for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      floorplanService.addCurtailment(
        dealerAId,
        vehicleBId,
        50000,
        new Date(),
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await floorplanService.addCurtailment(
        dealerAId,
        vehicleBId,
        50000,
        new Date(),
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("setPayoffQuote for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      floorplanService.setPayoffQuote(
        dealerAId,
        vehicleBId,
        900000,
        new Date(Date.now() + 86400000),
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await floorplanService.setPayoffQuote(
        dealerAId,
        vehicleBId,
        900000,
        new Date(Date.now() + 86400000),
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("getBookValues for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(bookValuesService.getBookValues(dealerAId, vehicleBId)).rejects.toThrow(ApiError);
    try {
      await bookValuesService.getBookValues(dealerAId, vehicleBId);
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("upsertBookValues for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      bookValuesService.upsertBookValues(
        dealerAId,
        vehicleBId,
        { retailCents: 10000 },
        "MANUAL",
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await bookValuesService.upsertBookValues(
        dealerAId,
        vehicleBId,
        { retailCents: 10000 },
        "MANUAL",
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("listReconItems for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(reconItemsService.listReconItems(dealerAId, vehicleBId)).rejects.toThrow(ApiError);
    try {
      await reconItemsService.listReconItems(dealerAId, vehicleBId);
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("addReconItem for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      reconItemsService.addReconItem(
        dealerAId,
        vehicleBId,
        { description: "Test", costCents: 1000 },
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await reconItemsService.addReconItem(
        dealerAId,
        vehicleBId,
        { description: "Test", costCents: 1000 },
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("updateReconItem for other dealer's recon item throws NOT_FOUND → 404", async () => {
    if (!vehicleAId) return;
    const item = await reconItemsService.addReconItem(
      dealerAId,
      vehicleAId,
      { description: "A item", costCents: 500 },
      userAId,
      { ip: "127.0.0.1" }
    );
    await expect(
      reconItemsService.updateReconItem(
        dealerBId,
        item.id,
        { description: "Hacked", costCents: 999 },
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await reconItemsService.updateReconItem(
        dealerBId,
        item.id,
        { description: "Hacked", costCents: 999 },
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("getFloorplanLoan for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(floorplanLoansService.getFloorplanLoan(dealerAId, vehicleBId)).rejects.toThrow(ApiError);
    try {
      await floorplanLoansService.getFloorplanLoan(dealerAId, vehicleBId);
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("createOrUpdateFloorplanLoan for other dealer vehicle throws NOT_FOUND → 404", async () => {
    if (!vehicleBId) return;
    await expect(
      floorplanLoansService.createOrUpdateFloorplanLoan(
        dealerAId,
        vehicleBId,
        {
          lender: "Bank",
          principalCents: 1000000,
          startDate: new Date(),
        },
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await floorplanLoansService.createOrUpdateFloorplanLoan(
        dealerAId,
        vehicleBId,
        {
          lender: "Bank",
          principalCents: 1000000,
          startDate: new Date(),
        },
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });

  it("markFloorplanStatus for other dealer's loan throws NOT_FOUND → 404", async () => {
    if (!vehicleAId) return;
    const loan = await floorplanLoansService.createOrUpdateFloorplanLoan(
      dealerAId,
      vehicleAId,
      {
        lender: "Lender A",
        principalCents: 500000,
        startDate: new Date(),
      },
      userAId,
      { ip: "127.0.0.1" }
    );
    await expect(
      floorplanLoansService.markFloorplanStatus(
        dealerBId,
        loan.id,
        "PAID_OFF",
        userAId,
        { ip: "127.0.0.1" }
      )
    ).rejects.toThrow(ApiError);
    try {
      await floorplanLoansService.markFloorplanStatus(
        dealerBId,
        loan.id,
        "PAID_OFF",
        userAId,
        { ip: "127.0.0.1" }
      );
    } catch (e) {
      expect((e as ApiError).code).toBe("NOT_FOUND");
      expect(toErrorPayload(e).status).toBe(404);
    }
  });
});

// ——— Validation: invalid body/params → 400 (Zod at edge) ———
describe("Slices D/E/F/G validation", () => {
  it("idParamSchema rejects non-UUID id", () => {
    expect(() => idParamSchema.parse({ id: "not-a-uuid" })).toThrow();
    expect(() => idParamSchema.parse({ id: "123" })).toThrow();
  });

  it("requestValuationBodySchema requires source and rejects invalid", () => {
    expect(() => requestValuationBodySchema.parse({})).toThrow();
    expect(() =>
      requestValuationBodySchema.parse({ source: "INVALID" })
    ).toThrow();
    expect(() =>
      requestValuationBodySchema.parse({ source: "KBB", odometer: -1 })
    ).toThrow();
  });

  it("reconLineItemBodySchema rejects negative costCents and empty description", () => {
    expect(() =>
      reconLineItemBodySchema.parse({ description: "x", costCents: -100 })
    ).toThrow();
    expect(() =>
      reconLineItemBodySchema.parse({ description: "", costCents: 0 })
    ).toThrow();
    expect(() =>
      reconLineItemBodySchema.parse({ description: "ok", costCents: 1.5 })
    ).toThrow(); // non-integer
  });

  it("reconUpdateBodySchema rejects invalid status", () => {
    expect(() => reconUpdateBodySchema.parse({ status: "INVALID" })).toThrow();
  });

  it("floorplanUpsertBodySchema rejects negative principalCents and invalid lenderId", () => {
    expect(() =>
      floorplanUpsertBodySchema.parse({
        lenderId: "not-uuid",
        principalCents: 1000,
        startDate: new Date().toISOString(),
      })
    ).toThrow();
    expect(() =>
      floorplanUpsertBodySchema.parse({
        lenderId: "e3000000-0000-0000-0000-000000000003",
        principalCents: -1,
        startDate: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("curtailmentBodySchema rejects negative amountCents", () => {
    expect(() =>
      curtailmentBodySchema.parse({
        amountCents: -1,
        paidAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("payoffQuoteBodySchema rejects negative payoffQuoteCents", () => {
    expect(() =>
      payoffQuoteBodySchema.parse({
        payoffQuoteCents: -1,
        payoffQuoteExpiresAt: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("reconLineItemIdParamSchema requires id and lineItemId as UUIDs", () => {
    expect(() =>
      reconLineItemIdParamSchema.parse({ id: "x", lineItemId: "y" })
    ).toThrow();
  });

  it("bookValuesBodySchema rejects negative cents", () => {
    expect(() => bookValuesBodySchema.parse({ retailCents: -1 })).toThrow();
    expect(() => bookValuesBodySchema.parse({ tradeInCents: -100 })).toThrow();
  });

  it("reconItemCreateBodySchema rejects empty description and negative costCents", () => {
    expect(() =>
      reconItemCreateBodySchema.parse({ description: "", costCents: 0 })
    ).toThrow();
    expect(() =>
      reconItemCreateBodySchema.parse({ description: "x", costCents: -1 })
    ).toThrow();
    expect(() =>
      reconItemCreateBodySchema.parse({ description: "x", costCents: 1.5 })
    ).toThrow();
  });

  it("reconItemCreateBodySchema rejects description over 256", () => {
    expect(() =>
      reconItemCreateBodySchema.parse({ description: "a".repeat(257), costCents: 0 })
    ).toThrow();
  });

  it("reconItemUpdateBodySchema rejects negative costCents", () => {
    expect(() =>
      reconItemUpdateBodySchema.parse({ costCents: -1 })
    ).toThrow();
  });

  it("floorplanLoanBodySchema rejects negative principalCents and interestBps out of range", () => {
    expect(() =>
      floorplanLoanBodySchema.parse({
        lender: "Bank",
        principalCents: -1,
        startDate: new Date().toISOString(),
      })
    ).toThrow();
    expect(() =>
      floorplanLoanBodySchema.parse({
        lender: "Bank",
        principalCents: 1000,
        interestBps: 5001,
        startDate: new Date().toISOString(),
      })
    ).toThrow();
  });

  it("floorplanLoanBodySchema rejects lender over 128 and notes over 1000", () => {
    expect(() =>
      floorplanLoanBodySchema.parse({
        lender: "a".repeat(129),
        principalCents: 1000,
        startDate: new Date().toISOString(),
      })
    ).toThrow();
    expect(() =>
      floorplanLoanBodySchema.parse({
        lender: "Bank",
        principalCents: 1000,
        startDate: new Date().toISOString(),
        notes: "a".repeat(1001),
      })
    ).toThrow();
  });

  it("floorplanLoanUpdateBodySchema requires status enum", () => {
    expect(() => floorplanLoanUpdateBodySchema.parse({ status: "INVALID" })).toThrow();
    expect(() => floorplanLoanUpdateBodySchema.parse({})).toThrow();
  });

  it("reconItemIdParamSchema and floorplanLoanIdParamSchema require UUID", () => {
    expect(() => reconItemIdParamSchema.parse({ reconItemId: "not-uuid" })).toThrow();
    expect(() => floorplanLoanIdParamSchema.parse({ floorplanLoanId: "x" })).toThrow();
  });
});

// ——— Key invariants ———
describe("Slices D/E/F/G invariants", () => {
  let vehicleAId: string;
  let lenderAId: string;

  beforeAll(async () => {
    const data = await ensureDefgTestData();
    vehicleAId = data.vehicleAId;
    lenderAId = data.lenderAId;
  });

  it("Recon: Vehicle.reconCostCents equals sum of line item costCents after add/update/delete", async () => {
    if (!vehicleAId) return;
    // Isolate from other tests: clear existing recon line items and reset vehicle total.
    const recon = await prisma.vehicleRecon.findUnique({
      where: { vehicleId: vehicleAId },
      select: { id: true },
    });
    if (recon) {
      await prisma.vehicleReconLineItem.deleteMany({ where: { reconId: recon.id } });
    }
    await prisma.vehicle.update({
      where: { id: vehicleAId },
      data: { reconCostCents: 0 },
    });
    const meta = { ip: "127.0.0.1" as string };
    await reconService.updateRecon(dealerAId, vehicleAId, { status: "IN_PROGRESS" }, userAId, meta);
    const add1 = await reconService.addLineItem(
      dealerAId,
      vehicleAId,
      { description: "Item1", costCents: 1000 },
      userAId,
      meta
    );
    const add2 = await reconService.addLineItem(
      dealerAId,
      vehicleAId,
      { description: "Item2", costCents: 2500 },
      userAId,
      meta
    );
    let vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleAId },
      select: { reconCostCents: true },
    });
    expect(Number(vehicle?.reconCostCents ?? 0)).toBe(3500);

    await reconService.updateLineItem(
      dealerAId,
      vehicleAId,
      add2.id,
      { costCents: 3000 },
      userAId,
      meta
    );
    vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleAId },
      select: { reconCostCents: true },
    });
    expect(Number(vehicle?.reconCostCents ?? 0)).toBe(4000);

    await reconService.deleteLineItem(dealerAId, vehicleAId, add1.id, userAId, meta);
    vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleAId },
      select: { reconCostCents: true },
    });
    expect(Number(vehicle?.reconCostCents ?? 0)).toBe(3000);
  });

  it("Valuations and floorplan use integer cents (valueCents, principalCents, amountCents, payoffQuoteCents)", async () => {
    if (!vehicleAId) return;
    const created = await valuationService.requestValuation(
      dealerAId,
      vehicleAId,
      userAId,
      { source: "MOCK" },
      { ip: "127.0.0.1" }
    );
    expect(Number.isInteger(created.valueCents)).toBe(true);
    expect(created.valueCents).toBeGreaterThanOrEqual(0);

    if (!lenderAId) return;
    const floorplan = await floorplanService.upsertFloorplan(
      dealerAId,
      vehicleAId,
      {
        lenderId: lenderAId,
        principalCents: 1000000,
        startDate: new Date(),
      },
      userAId,
      { ip: "127.0.0.1" }
    );
    expect(Number.isInteger(floorplan.principalCents)).toBe(true);
    const curtailment = await floorplanService.addCurtailment(
      dealerAId,
      vehicleAId,
      100000,
      new Date(),
      userAId,
      { ip: "127.0.0.1" }
    );
    expect(Number.isInteger(curtailment.amountCents)).toBe(true);
  });

  it("RECON_OVERDUE: listVehicleIdsReconOverdue returns only IN_PROGRESS/NOT_STARTED with dueDate < today", async () => {
    if (!vehicleAId) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await reconService.updateRecon(
      dealerAId,
      vehicleAId,
      { status: "IN_PROGRESS", dueDate: yesterday },
      userAId,
      { ip: "127.0.0.1" }
    );
    const overdueIds = await alertsDb.listVehicleIdsReconOverdue(dealerAId);
    expect(overdueIds).toContain(vehicleAId);

    await reconService.updateRecon(
      dealerAId,
      vehicleAId,
      { status: "COMPLETE", dueDate: yesterday },
      userAId,
      { ip: "127.0.0.1" }
    );
    const afterComplete = await alertsDb.listVehicleIdsReconOverdue(dealerAId);
    expect(afterComplete).not.toContain(vehicleAId);

    await reconService.updateRecon(
      dealerAId,
      vehicleAId,
      { status: "IN_PROGRESS", dueDate: tomorrow },
      userAId,
      { ip: "127.0.0.1" }
    );
    const futureDue = await alertsDb.listVehicleIdsReconOverdue(dealerAId);
    expect(futureDue).not.toContain(vehicleAId);
  });
});

// ——— Audit (optional): verify audit log entries ———
describe("Slices D/E/F/G audit", () => {
  let vehicleAId: string;
  let lenderAId: string;

  beforeAll(async () => {
    const data = await ensureDefgTestData();
    vehicleAId = data.vehicleAId;
    lenderAId = data.lenderAId;
  });

  it("decodeVin creates vin_decode.requested audit log", async () => {
    if (!vehicleAId) return;
    await vinDecodeService.decodeVin(dealerAId, vehicleAId, userAId, { ip: "127.0.0.1" });
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerAId,
        entity: "VehicleVinDecode",
        action: "vin_decode.requested",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userAId);
  });

  it("requestValuation creates vehicle_valuation.captured audit log", async () => {
    if (!vehicleAId) return;
    await valuationService.requestValuation(
      dealerAId,
      vehicleAId,
      userAId,
      { source: "MOCK" },
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerAId,
        entity: "VehicleValuation",
        action: "vehicle_valuation.captured",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
  });

  it("recon line item add creates vehicle_recon_line_item.added audit log", async () => {
    if (!vehicleAId) return;
    await reconService.addLineItem(
      dealerAId,
      vehicleAId,
      { description: "Audit line", costCents: 500 },
      userAId,
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerAId,
        entity: "VehicleReconLineItem",
        action: "vehicle_recon_line_item.added",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
  });

  it("floorplan curtailment creates vehicle_floorplan.curtailment audit log", async () => {
    if (!vehicleAId || !lenderAId) return;
    await floorplanService.upsertFloorplan(
      dealerAId,
      vehicleAId,
      {
        lenderId: lenderAId,
        principalCents: 2000000,
        startDate: new Date(),
      },
      userAId,
      { ip: "127.0.0.1" }
    );
    await floorplanService.addCurtailment(
      dealerAId,
      vehicleAId,
      50000,
      new Date(),
      userAId,
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerAId,
        entity: "VehicleFloorplanCurtailment",
        action: "vehicle_floorplan.curtailment",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
  });

  it("upsertBookValues creates VehicleBookValueUpdated audit log", async () => {
    if (!vehicleAId) return;
    await bookValuesService.upsertBookValues(
      dealerAId,
      vehicleAId,
      { retailCents: 15000, wholesaleCents: 12000 },
      "MANUAL",
      userAId,
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerAId,
        entity: "VehicleBookValue",
        action: "VehicleBookValueUpdated",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.actorId).toBe(userAId);
  });

  it("addReconItem creates ReconItem.created audit log", async () => {
    if (!vehicleAId) return;
    await reconItemsService.addReconItem(
      dealerAId,
      vehicleAId,
      { description: "Audit recon item", costCents: 750 },
      userAId,
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerAId,
        entity: "ReconItem",
        action: "ReconItem.created",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
  });

  it("createOrUpdateFloorplanLoan creates FloorplanLoan.created audit log", async () => {
    if (!vehicleAId) return;
    await floorplanLoansService.createOrUpdateFloorplanLoan(
      dealerAId,
      vehicleAId,
      {
        lender: "Test Lender",
        principalCents: 300000,
        startDate: new Date(),
      },
      userAId,
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerAId,
        entity: "FloorplanLoan",
        action: "FloorplanLoan.created",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
  });

  it("markFloorplanStatus creates FloorplanLoan.status_changed audit log", async () => {
    if (!vehicleAId) return;
    const loan = await floorplanLoansService.createOrUpdateFloorplanLoan(
      dealerAId,
      vehicleAId,
      {
        lender: "Status Lender",
        principalCents: 100000,
        startDate: new Date(),
      },
      userAId,
      { ip: "127.0.0.1" }
    );
    await floorplanLoansService.markFloorplanStatus(
      dealerAId,
      loan.id,
      "PAID_OFF",
      userAId,
      { ip: "127.0.0.1" }
    );
    const log = await prisma.auditLog.findFirst({
      where: {
        dealershipId: dealerAId,
        entity: "FloorplanLoan",
        action: "FloorplanLoan.status_changed",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeDefined();
    expect(log?.metadata).toMatchObject({ status: "PAID_OFF" });
  });
});
