/** @jest-environment node */
/**
 * Integration tests: tenant isolation, permission gating, limit/offset safety.
 * Skip when SKIP_INTEGRATION_TESTS=1 or no TEST_DATABASE_URL.
 */
import { prisma } from "@/lib/db";
import { globalSearch } from "../service/global-search";


const dealerAId = "10000000-0000-0000-0000-000000000001";
const dealerBId = "20000000-0000-0000-0000-000000000002";

async function ensureTestData(): Promise<void> {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Search Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Search Dealer B" },
    update: {},
  });
  await prisma.profile.upsert({
    where: { id: "30000000-0000-0000-0000-000000000003" },
    create: { id: "30000000-0000-0000-0000-000000000003", email: "search@test.local" },
    update: {},
  });
  const customerB = await prisma.customer.upsert({
    where: { id: "40000000-0000-0000-0000-000000000004" },
    create: {
      id: "40000000-0000-0000-0000-000000000004",
      dealershipId: dealerBId,
      name: "UniqueBNameSearch",
      status: "LEAD",
    },
    update: { name: "UniqueBNameSearch" },
  });
  const vehicleB = await prisma.vehicle.upsert({
    where: { id: "50000000-0000-0000-0000-000000000005" },
    create: {
      id: "50000000-0000-0000-0000-000000000005",
      dealershipId: dealerBId,
      stockNumber: "SB-UNIQUE-001",
      status: "AVAILABLE",
    },
    update: { stockNumber: "SB-UNIQUE-001" },
  });
  await prisma.deal.upsert({
    where: { id: "60000000-0000-0000-0000-000000000006" },
    create: {
      id: "60000000-0000-0000-0000-000000000006",
      dealershipId: dealerBId,
      customerId: customerB.id,
      vehicleId: vehicleB.id,
      salePriceCents: BigInt(10000),
      purchasePriceCents: BigInt(9000),
      taxRateBps: 700,
      taxCents: BigInt(70),
      docFeeCents: BigInt(0),
      downPaymentCents: BigInt(0),
      totalFeesCents: BigInt(0),
      totalDueCents: BigInt(10070),
      frontGrossCents: BigInt(1000),
      status: "DRAFT",
    },
    update: {},
  });
}

describe("Global search integration", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  it("tenant isolation: search as Dealer A with term matching only Dealer B returns no B data", async () => {
    const dealerBEntityIds = [
      "40000000-0000-0000-0000-000000000004", // customer
      "50000000-0000-0000-0000-000000000005", // vehicle
      "60000000-0000-0000-0000-000000000006", // deal
    ];
    const { data } = await globalSearch({
      dealershipId: dealerAId,
      q: "UniqueBNameSearch",
      limit: 20,
      offset: 0,
      permissions: ["customers.read", "deals.read", "inventory.read"],
    });
    // Data array must not contain any entity belonging to another tenant.
    const allIds = data.map((r) => r.id);
    for (const bId of dealerBEntityIds) {
      expect(allIds).not.toContain(bId);
    }
    expect(data.every((item) => !dealerBEntityIds.includes(item.id))).toBe(true);
  });

  it("permission gating: only customers.read returns only customer items", async () => {
    const { data } = await globalSearch({
      dealershipId: dealerAId,
      q: "a",
      limit: 20,
      offset: 0,
      permissions: ["customers.read"],
    });
    expect(data.every((r) => r.type === "customer")).toBe(true);
  });

  it("permission gating: only deals.read returns only deal items", async () => {
    const { data } = await globalSearch({
      dealershipId: dealerAId,
      q: "a",
      limit: 20,
      offset: 0,
      permissions: ["deals.read"],
    });
    expect(data.every((r) => r.type === "deal")).toBe(true);
  });

  it("permission gating: only inventory.read returns only inventory items", async () => {
    const { data } = await globalSearch({
      dealershipId: dealerAId,
      q: "a",
      limit: 20,
      offset: 0,
      permissions: ["inventory.read"],
    });
    expect(data.every((r) => r.type === "inventory")).toBe(true);
  });

  it("no permissions returns empty data (200 with empty array)", async () => {
    const { data } = await globalSearch({
      dealershipId: dealerAId,
      q: "something",
      limit: 20,
      offset: 0,
      permissions: [],
    });
    expect(data).toEqual([]);
  });

  it("limit + offset: result length at most limit", async () => {
    const { data, meta } = await globalSearch({
      dealershipId: dealerAId,
      q: "a",
      limit: 5,
      offset: 0,
      permissions: ["customers.read", "deals.read", "inventory.read"],
    });
    expect(data.length).toBeLessThanOrEqual(5);
    expect(meta.limit).toBe(5);
    expect(meta.offset).toBe(0);
  });

  it("limit cap: service with limit 50 returns at most 50 items and meta.limit 50", async () => {
    const { data, meta } = await globalSearch({
      dealershipId: dealerAId,
      q: "a",
      limit: 50,
      offset: 0,
      permissions: ["customers.read", "deals.read", "inventory.read"],
    });
    expect(data.length).toBeLessThanOrEqual(50);
    expect(meta.limit).toBe(50);
    expect(meta.offset).toBe(0);
  });

  it("valid limit and offset return 200-shaped result", async () => {
    const { data, meta } = await globalSearch({
      dealershipId: dealerAId,
      q: "ab",
      limit: 20,
      offset: 0,
      permissions: ["customers.read"],
    });
    expect(Array.isArray(data)).toBe(true);
    expect(meta).toEqual({ limit: 20, offset: 0 });
  });
});
