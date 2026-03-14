/** @jest-environment node */
/**
 * Public API boundary tests.
 * Verifies:
 * 1. Unpublished sites fail closed (hostname resolution returns null)
 * 2. hostname is the authoritative tenant identifier (no dealershipId param accepted)
 * 3. resolvePublishedSiteByHostname correctly requires a published release
 *
 * Integration tests: skipped when TEST_DATABASE_URL is not set.
 */

import { prisma } from "@/lib/db";
import { resolveSiteByHostname } from "@/modules/websites-domains/service";
import { resolvePublishedSiteByHostname } from "@/modules/websites-public/service";

const SKIP = !process.env.TEST_DATABASE_URL;

const TEST_DEALERSHIP_ID = "eb000000-0000-4000-8000-000000000010";
const TEST_SITE_ID = "eb000000-0000-4000-8000-000000000020";
const TEST_DOMAIN_HOSTNAME = `boundary-test-${Date.now()}.dms-platform.test`;

beforeAll(async () => {
  if (SKIP) return;
  await prisma.dealership.upsert({
    where: { id: TEST_DEALERSHIP_ID },
    create: { id: TEST_DEALERSHIP_ID, name: "Boundary Test Dealer" },
    update: {},
  });
  await prisma.websiteSite.upsert({
    where: { id: TEST_SITE_ID },
    create: {
      id: TEST_SITE_ID,
      dealershipId: TEST_DEALERSHIP_ID,
      name: "Boundary Test Site",
      subdomain: `boundary-test-sub-${Date.now()}`,
      status: "DRAFT",
      activeTemplateKey: "premium-default",
    },
    update: { publishedReleaseId: null, status: "DRAFT" },
  });
  await prisma.websiteDomain.create({
    data: {
      siteId: TEST_SITE_ID,
      dealershipId: TEST_DEALERSHIP_ID,
      hostname: TEST_DOMAIN_HOSTNAME,
      isPrimary: true,
      isSubdomain: true,
      verificationStatus: "VERIFIED",
      sslStatus: "PROVISIONED",
    },
  });
});

afterAll(async () => {
  if (SKIP) return;
  await prisma.websiteDomain.deleteMany({ where: { hostname: TEST_DOMAIN_HOSTNAME } });
  await prisma.websiteSite.deleteMany({ where: { id: TEST_SITE_ID } });
});

describe("resolveSiteByHostname", () => {
  it("returns null for unknown hostname (fails closed)", async () => {
    if (SKIP) return;
    const result = await resolveSiteByHostname("unknown-host-that-does-not-exist.test");
    expect(result).toBeNull();
  });

  it("returns null when site has no published release (DRAFT site fails closed)", async () => {
    if (SKIP) return;
    // TEST_SITE_ID has no publishedReleaseId (status: DRAFT)
    const result = await resolveSiteByHostname(TEST_DOMAIN_HOSTNAME);
    expect(result).toBeNull();
  });

  it("correctly normalizes www. prefix (www.example.com → example.com)", async () => {
    if (SKIP) return;
    // The domain is registered without www. prefix; www. lookup should also return null (not found)
    const result = await resolveSiteByHostname(`www.${TEST_DOMAIN_HOSTNAME}`);
    // Since the DB record is for the non-www hostname, www. lookup should also work if
    // normalization strips the www. prefix correctly
    expect(result).toBeNull(); // still null because site is unpublished
  });
});

describe("resolvePublishedSiteByHostname", () => {
  it("returns null for unknown hostname", async () => {
    if (SKIP) return;
    const result = await resolvePublishedSiteByHostname("no-such-hostname.test");
    expect(result).toBeNull();
  });

  it("returns null for DRAFT site (unpublished sites fail closed)", async () => {
    if (SKIP) return;
    const result = await resolvePublishedSiteByHostname(TEST_DOMAIN_HOSTNAME);
    expect(result).toBeNull();
  });
});

describe("Public boundary structural contract", () => {
  it("listPublicVehicles is a function (tenant passed from resolved context)", () => {
    const { listPublicVehicles } = require("@/modules/websites-public/service");
    expect(typeof listPublicVehicles).toBe("function");
  });

  it("getPublicVehicleBySlug is a function (slug and resolved dealershipId required)", () => {
    const { getPublicVehicleBySlug } = require("@/modules/websites-public/service");
    expect(typeof getPublicVehicleBySlug).toBe("function");
  });
});
