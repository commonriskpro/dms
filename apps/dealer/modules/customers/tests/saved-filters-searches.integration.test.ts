/** @jest-environment node */
/**
 * Integration tests: SavedFilter and SavedSearch
 * - Tenant isolation: dealer A cannot access dealer B data (NOT_FOUND)
 * - RBAC: customers.read required for list; admin.settings.manage for SHARED create/delete
 * - PERSONAL: only owner can delete/update
 * - stateJson validation: invalid sortBy/limit rejected by Zod
 */
import { prisma } from "@/lib/db";
import { loadUserPermissions } from "@/lib/rbac";
import * as savedFiltersService from "@/modules/customers/service/saved-filters";
import * as savedSearchesService from "@/modules/customers/service/saved-searches";
import { stateJsonSchema } from "@/app/api/customers/saved-schemas";


const dealerA = "a1000000-0000-0000-0000-000000000001";
const dealerB = "a1000000-0000-0000-0000-000000000002";
const userWithRead = "a2000000-0000-0000-0000-000000000001";
const userNoCustomers = "a2000000-0000-0000-0000-000000000002";
const userAdmin = "a2000000-0000-0000-0000-000000000003";

async function ensureTestData() {
  await prisma.dealership.upsert({
    where: { id: dealerA },
    create: { id: dealerA, name: "Saved Filters Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerB },
    create: { id: dealerB, name: "Saved Filters Dealer B" },
    update: {},
  });
  for (const [id, email] of [
    [userWithRead, "saved-read@test.local"],
    [userNoCustomers, "saved-nocust@test.local"],
    [userAdmin, "saved-admin@test.local"],
  ] as const) {
    await prisma.profile.upsert({
      where: { id },
      create: { id, email },
      update: {},
    });
  }
  const permRead = await prisma.permission.upsert({
    where: { key: "customers.read" },
    create: { key: "customers.read", description: null, module: "customers" },
    update: {},
  });
  const permAdmin = await prisma.permission.upsert({
    where: { key: "admin.settings.manage" },
    create: { key: "admin.settings.manage", description: null, module: "admin" },
    update: {},
  });
  const roleRead = await prisma.role.upsert({
    where: { id: "a3000000-0000-0000-0000-000000000001" },
    create: {
      id: "a3000000-0000-0000-0000-000000000001",
      dealershipId: dealerA,
      name: "SavedRead",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permRead.id }] },
    },
    update: {},
  });
  const roleAdmin = await prisma.role.upsert({
    where: { id: "a3000000-0000-0000-0000-000000000002" },
    create: {
      id: "a3000000-0000-0000-0000-000000000002",
      dealershipId: dealerA,
      name: "SavedAdmin",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permRead.id }, { permissionId: permAdmin.id }] },
    },
    update: {},
  });
  const roleNoCustomers = await prisma.role.upsert({
    where: { id: "a3000000-0000-0000-0000-000000000003" },
    create: {
      id: "a3000000-0000-0000-0000-000000000003",
      dealershipId: dealerA,
      name: "NoCustomers",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permAdmin.id }] },
    },
    update: {},
  });
  await prisma.membership.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000001" },
    create: {
      id: "a4000000-0000-0000-0000-000000000001",
      dealershipId: dealerA,
      userId: userWithRead,
      roleId: roleRead.id,
    },
    update: { roleId: roleRead.id },
  });
  await prisma.membership.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000002" },
    create: {
      id: "a4000000-0000-0000-0000-000000000002",
      dealershipId: dealerA,
      userId: userNoCustomers,
      roleId: roleNoCustomers.id,
    },
    update: { roleId: roleNoCustomers.id },
  });
  await prisma.membership.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000003" },
    create: {
      id: "a4000000-0000-0000-0000-000000000003",
      dealershipId: dealerA,
      userId: userAdmin,
      roleId: roleAdmin.id,
    },
    update: { roleId: roleAdmin.id },
  });
}

describe("SavedFilter / SavedSearch integration", () => {
  beforeAll(async () => {
    await ensureTestData();
  });

  describe("tenant isolation", () => {
    it("dealer B cannot access dealer A saved filter by id", async () => {
      const permsRead = await loadUserPermissions(userWithRead, dealerA);
      const created = await savedFiltersService.createSavedFilter(
        dealerA,
        userWithRead,
        { name: "Filter A", visibility: "PERSONAL", definition: { status: "LEAD" } },
        permsRead
      );
      const { getSavedFilterById } = await import("@/modules/customers/db/saved-filters");
      const fromDealerB = await getSavedFilterById(dealerB, created.id);
      expect(fromDealerB).toBeNull();
      await prisma.savedFilter.deleteMany({ where: { id: created.id } });
    });

    it("dealer B cannot access dealer A saved search by id", async () => {
      const permsRead = await loadUserPermissions(userWithRead, dealerA);
      const created = await savedSearchesService.createSavedSearch(
        dealerA,
        userWithRead,
        { name: "Search A", visibility: "PERSONAL", state: { q: "test", limit: 10 } },
        permsRead
      );
      const { getSavedSearchById } = await import("@/modules/customers/db/saved-searches");
      const fromDealerB = await getSavedSearchById(dealerB, created.id);
      expect(fromDealerB).toBeNull();
      await prisma.savedSearch.deleteMany({ where: { id: created.id } });
    });

    it("deleteSavedFilter for id from another dealership returns NOT_FOUND", async () => {
      const permsRead = await loadUserPermissions(userWithRead, dealerA);
      const created = await savedFiltersService.createSavedFilter(
        dealerA,
        userWithRead,
        { name: "Filter A2", visibility: "PERSONAL", definition: {} },
        permsRead
      );
      const permsB = await loadUserPermissions(userAdmin, dealerB);
      await expect(
        savedFiltersService.deleteSavedFilter(dealerB, userAdmin, created.id, permsB)
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await prisma.savedFilter.deleteMany({ where: { id: created.id } });
    });
  });

  describe("RBAC", () => {
    it("user with customers.read can create PERSONAL saved filter", async () => {
      const perms = await loadUserPermissions(userWithRead, dealerA);
      expect(perms).toContain("customers.read");
      const created = await savedFiltersService.createSavedFilter(
        dealerA,
        userWithRead,
        { name: "My Personal Filter", visibility: "PERSONAL", definition: { status: "ACTIVE" } },
        perms
      );
      expect(created.visibility).toBe("PERSONAL");
      expect(created.ownerUserId).toBe(userWithRead);
      await prisma.savedFilter.deleteMany({ where: { id: created.id } });
    });

    it("user without admin.settings.manage cannot create SHARED saved filter", async () => {
      const perms = await loadUserPermissions(userWithRead, dealerA);
      expect(perms).not.toContain("admin.settings.manage");
      await expect(
        savedFiltersService.createSavedFilter(
          dealerA,
          userWithRead,
          { name: "Shared Filter", visibility: "SHARED", definition: {} },
          perms
        )
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("user with admin.settings.manage can create SHARED saved filter", async () => {
      const perms = await loadUserPermissions(userAdmin, dealerA);
      expect(perms).toContain("admin.settings.manage");
      const created = await savedFiltersService.createSavedFilter(
        dealerA,
        userAdmin,
        { name: "Shared Filter Admin", visibility: "SHARED", definition: { leadSource: "Web" } },
        perms
      );
      expect(created.visibility).toBe("SHARED");
      await prisma.savedFilter.deleteMany({ where: { id: created.id } });
    });

    it("user cannot delete another user PERSONAL saved filter", async () => {
      const permsRead = await loadUserPermissions(userWithRead, dealerA);
      const created = await savedFiltersService.createSavedFilter(
        dealerA,
        userWithRead,
        { name: "Personal Filter", visibility: "PERSONAL", definition: {} },
        permsRead
      );
      const permsAdmin = await loadUserPermissions(userAdmin, dealerA);
      await expect(
        savedFiltersService.deleteSavedFilter(dealerA, userAdmin, created.id, permsAdmin)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await prisma.savedFilter.deleteMany({ where: { id: created.id } });
    });

    it("owner can delete own PERSONAL saved filter", async () => {
      const perms = await loadUserPermissions(userWithRead, dealerA);
      const created = await savedFiltersService.createSavedFilter(
        dealerA,
        userWithRead,
        { name: "To Delete", visibility: "PERSONAL", definition: {} },
        perms
      );
      await savedFiltersService.deleteSavedFilter(dealerA, userWithRead, created.id, perms);
      const row = await prisma.savedFilter.findUnique({ where: { id: created.id } });
      expect(row).toBeNull();
    });
  });

  describe("saved search apply does not bypass RBAC", () => {
    it("listSavedSearches returns only items for same dealership", async () => {
      const permsA = await loadUserPermissions(userWithRead, dealerA);
      const createdA = await savedSearchesService.createSavedSearch(
        dealerA,
        userWithRead,
        { name: "Search Dealer A", visibility: "PERSONAL", state: { q: "a", limit: 10 } },
        permsA
      );
      const listA = await savedSearchesService.listSavedSearches(dealerA, userWithRead);
      expect(listA.map((s) => s.id)).toContain(createdA.id);
      const listB = await savedSearchesService.listSavedSearches(dealerB, userWithRead);
      expect(listB.map((s) => s.id)).not.toContain(createdA.id);
      await prisma.savedSearch.deleteMany({ where: { id: createdA.id } });
    });
  });
});

describe("buildCustomersQuery (URL params)", () => {
  const { buildCustomersQuery } = require("@/modules/customers/ui/CustomersPageClient");

  it("converts limit/offset to page/pageSize (e.g. limit=25, offset=50 → page=3, pageSize=25)", () => {
    const q = buildCustomersQuery({
      limit: 25,
      offset: 50,
      sortBy: "created_at",
      sortOrder: "desc",
    });
    expect(q).toContain("page=3");
    expect(q).toContain("pageSize=25");
  });

  it("preserves all params when only q changes (state uses limit/offset, output uses page/pageSize)", () => {
    const params = {
      limit: 10,
      offset: 0,
      sortBy: "status",
      sortOrder: "asc" as const,
      status: "LEAD",
      q: "test",
    };
    const q = buildCustomersQuery(params);
    expect(q).toContain("page=1");
    expect(q).toContain("pageSize=10");
    expect(q).toContain("sortBy=status");
    expect(q).toContain("sortOrder=asc");
    expect(q).toContain("status=LEAD");
    expect(q).toContain("q=test");
  });
});

describe("SavedFilter / SavedSearch stateJson validation (unit)", () => {
  it("rejects invalid sortBy in stateJson", () => {
    expect(() =>
      stateJsonSchema.parse({ sortBy: "invalid_column" })
    ).toThrow();
  });

  it("rejects limit > 100 in stateJson", () => {
    expect(() =>
      stateJsonSchema.parse({ limit: 500 })
    ).toThrow();
  });

  it("accepts valid stateJson", () => {
    const result = stateJsonSchema.parse({
      q: "test",
      status: "LEAD",
      sortBy: "created_at",
      sortOrder: "desc",
      limit: 25,
      offset: 0,
    });
    expect(result.sortBy).toBe("created_at");
    expect(result.limit).toBe(25);
  });
});
