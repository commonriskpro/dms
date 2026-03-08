/** @jest-environment node */
/**
 * Step 4 — Security & QA: GET/POST /api/customers route integration tests.
 * RBAC (including DealerCenter overrides), tenant isolation, validation, pagination, audit.
 * Run from repo root: npm -w apps/dealer run test -- app/api/customers/route.integration.test.ts
 */

jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
  };
});

import { getAuthContext } from "@/lib/api/handler";
import { GET, POST } from "./route";
import { prisma } from "@/lib/db";
import * as userAdminService from "@/modules/core-platform/service/user-admin";
import type { NextRequest } from "next/server";

const dealerAId = "a4000000-0000-0000-0000-000000000001";
const dealerBId = "a4000000-0000-0000-0000-000000000002";
const userNoReadId = "a4000000-0000-0000-0000-000000000003";
const userReadOnlyId = "a4000000-0000-0000-0000-000000000004";
const userReadWriteId = "a4000000-0000-0000-0000-000000000005";
const userOverrideRevokeId = "a4000000-0000-0000-0000-000000000006";
const userOverrideGrantId = "a4000000-0000-0000-0000-000000000007";
const actorAdminId = "a4000000-0000-0000-0000-000000000008";

function makeGetRequest(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/customers");
  Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  return {
    nextUrl: url,
    headers: new Headers(),
  } as unknown as NextRequest;
}

function makePostRequest(body: object, opts?: { contentLength?: string }): NextRequest {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (opts?.contentLength) headers.set("content-length", opts.contentLength);
  return {
    nextUrl: new URL("http://localhost/api/customers"),
    json: () => Promise.resolve(body),
    headers,
  } as unknown as NextRequest;
}

async function ensureTestData(): Promise<void> {
  await prisma.dealership.upsert({
    where: { id: dealerAId },
    create: { id: dealerAId, name: "Step4 Dealer A" },
    update: {},
  });
  await prisma.dealership.upsert({
    where: { id: dealerBId },
    create: { id: dealerBId, name: "Step4 Dealer B" },
    update: {},
  });
  for (const [id, email] of [
    [userNoReadId, "no-read@step4.test"],
    [userReadOnlyId, "read-only@step4.test"],
    [userReadWriteId, "read-write@step4.test"],
    [userOverrideRevokeId, "override-revoke@step4.test"],
    [userOverrideGrantId, "override-grant@step4.test"],
    [actorAdminId, "admin@step4.test"],
  ] as const) {
    await prisma.profile.upsert({
      where: { id },
      create: { id, email },
      update: {},
    });
  }

  const permRead = await prisma.permission.findFirst({ where: { key: "customers.read" } });
  const permWrite = await prisma.permission.findFirst({ where: { key: "customers.write" } });
  const permAdmin = await prisma.permission.findFirst({ where: { key: "admin.dealership.read" } });
  if (!permRead || !permWrite || !permAdmin) return;

  const roleNoCustomers = await prisma.role.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000011" },
    create: {
      id: "a4000000-0000-0000-0000-000000000011",
      dealershipId: dealerAId,
      name: "NoCustomers",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permAdmin.id }] },
    },
    update: {},
  });
  const roleReadOnly = await prisma.role.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000012" },
    create: {
      id: "a4000000-0000-0000-0000-000000000012",
      dealershipId: dealerAId,
      name: "CustomersReadOnly",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permRead.id }] },
    },
    update: {},
  });
  const roleReadWrite = await prisma.role.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000013" },
    create: {
      id: "a4000000-0000-0000-0000-000000000013",
      dealershipId: dealerAId,
      name: "CustomersReadWrite",
      isSystem: false,
      rolePermissions: {
        create: [{ permissionId: permRead.id }, { permissionId: permWrite.id }],
      },
    },
    update: {},
  });
  const roleNoRead = await prisma.role.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000014" },
    create: {
      id: "a4000000-0000-0000-0000-000000000014",
      dealershipId: dealerAId,
      name: "NoReadForOverride",
      isSystem: false,
      rolePermissions: { create: [{ permissionId: permAdmin.id }] },
    },
    update: {},
  });

  const membershipData = [
    { id: "a4000000-0000-0000-0000-000000000021", userId: userNoReadId, roleId: roleNoCustomers.id },
    { id: "a4000000-0000-0000-0000-000000000022", userId: userReadOnlyId, roleId: roleReadOnly.id },
    { id: "a4000000-0000-0000-0000-000000000023", userId: userReadWriteId, roleId: roleReadWrite.id },
    { id: "a4000000-0000-0000-0000-000000000024", userId: userOverrideRevokeId, roleId: roleReadOnly.id },
    { id: "a4000000-0000-0000-0000-000000000025", userId: userOverrideGrantId, roleId: roleNoRead.id },
    { id: "a4000000-0000-0000-0000-000000000026", userId: actorAdminId, roleId: roleReadWrite.id },
  ];
  for (const m of membershipData) {
    await prisma.membership.upsert({
      where: { id: m.id },
      create: { id: m.id, dealershipId: dealerAId, userId: m.userId, roleId: m.roleId },
      update: { roleId: m.roleId },
    });
  }
  await prisma.userRole.deleteMany({
    where: {
      userId: { in: [userNoReadId, userReadOnlyId, userReadWriteId, userOverrideRevokeId, userOverrideGrantId, actorAdminId] },
    },
  });
  await prisma.userRole.createMany({
    data: [
      { userId: userNoReadId, roleId: roleNoCustomers.id },
      { userId: userReadOnlyId, roleId: roleReadOnly.id },
      { userId: userReadWriteId, roleId: roleReadWrite.id },
      { userId: userOverrideRevokeId, roleId: roleReadOnly.id },
      { userId: userOverrideGrantId, roleId: roleNoRead.id },
      { userId: actorAdminId, roleId: roleReadWrite.id },
    ],
  });

  const roleB = await prisma.role.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000015" },
    create: {
      id: "a4000000-0000-0000-0000-000000000015",
      dealershipId: dealerBId,
      name: "CustomersReadWriteB",
      isSystem: false,
      rolePermissions: {
        create: [{ permissionId: permRead.id }, { permissionId: permWrite.id }],
      },
    },
    update: {},
  });
  await prisma.membership.upsert({
    where: { id: "a4000000-0000-0000-0000-000000000031" },
    create: {
      id: "a4000000-0000-0000-0000-000000000031",
      dealershipId: dealerBId,
      userId: userReadWriteId,
      roleId: roleB.id,
    },
    update: { roleId: roleB.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: userReadWriteId, roleId: roleB.id } },
    create: { userId: userReadWriteId, roleId: roleB.id },
    update: {},
  });
}

describe("GET/POST /api/customers route integration", () => {
  beforeAll(async () => {
    await ensureTestData();
  }, 15000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("RBAC", () => {
    it("GET without customers.read returns 403", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userNoReadId,
        email: "no-read@step4.test",
        dealershipId: dealerAId,
        permissions: [],
      });
      const req = makeGetRequest({ limit: "25", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error?.code).toBe("FORBIDDEN");
    });

    it("POST without customers.write returns 403", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadOnlyId,
        email: "read-only@step4.test",
        dealershipId: dealerAId,
        permissions: [],
      });
      const req = makePostRequest({ name: "Test Customer" });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error?.code).toBe("FORBIDDEN");
    });

    it("override enabled=false removes customers.read → GET returns 403", async () => {
      await userAdminService.setPermissionOverride(
        dealerAId,
        userOverrideRevokeId,
        "customers.read",
        false,
        actorAdminId
      );
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userOverrideRevokeId,
        email: "override-revoke@step4.test",
        dealershipId: dealerAId,
        permissions: [],
      });
      const req = makeGetRequest({ limit: "25", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error?.code).toBe("FORBIDDEN");
      await userAdminService.setPermissionOverride(
        dealerAId,
        userOverrideRevokeId,
        "customers.read",
        true,
        actorAdminId
      );
    });

    it("override enabled=true grants customers.read → GET returns 200", async () => {
      await userAdminService.setPermissionOverride(
        dealerAId,
        userOverrideGrantId,
        "customers.read",
        true,
        actorAdminId
      );
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userOverrideGrantId,
        email: "override-grant@step4.test",
        dealershipId: dealerAId,
        permissions: [],
      });
      const req = makeGetRequest({ limit: "25", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.meta).toBeDefined();
      expect(data.meta.limit).toBe(25);
      expect(data.meta.offset).toBe(0);
      await userAdminService.setPermissionOverride(
        dealerAId,
        userOverrideGrantId,
        "customers.read",
        false,
        actorAdminId
      );
    });
  });

  describe("Tenant isolation", () => {
    it("customer created in Dealer A does not appear in Dealer B GET list", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: [],
      });
      const postReq = makePostRequest({
        name: "Dealer A Only Customer " + Date.now(),
        status: "LEAD",
      });
      const postRes = await POST(postReq);
      expect(postRes.status).toBe(201);
      const postData = await postRes.json();
      const customerAId = postData.data?.id;
      expect(customerAId).toBeDefined();

      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerBId,
        permissions: [],
      });
      const getReq = makeGetRequest({ limit: "100", offset: "0", search: "Dealer A Only" });
      const getRes = await GET(getReq);
      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      const foundInB = getData.data?.find((c: { id: string }) => c.id === customerAId);
      expect(foundInB).toBeUndefined();
    });

    it("POST as Dealer B creates customer scoped to Dealer B (body cannot set dealershipId)", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerBId,
        permissions: [],
      });
      const body = {
        name: "Dealer B Scoped " + Date.now(),
        status: "LEAD",
      };
      const req = makePostRequest(body);
      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.data?.dealershipId).toBe(dealerBId);
      expect(data.data?.name).toBe(body.name);
    });
  });

  describe("Validation", () => {
    it("GET with invalid query (limit > 100) returns 400", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: ["customers.read"],
      });
      const req = makeGetRequest({ limit: "101", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error?.code).toBe("VALIDATION_ERROR");
    });

    it("GET with invalid sortBy returns 400", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: ["customers.read"],
      });
      const req = makeGetRequest({ limit: "25", offset: "0", sortBy: "name" });
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error?.code).toBe("VALIDATION_ERROR");
    });

    it("POST with missing name returns 400", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: ["customers.write"],
      });
      const req = makePostRequest({});
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error?.code).toBe("VALIDATION_ERROR");
    });

    it("POST with invalid email (non-string value in emails) returns 400", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: ["customers.write"],
      });
      const req = makePostRequest({
        name: "Valid Name",
        emails: [{ value: 123 }],
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error?.code).toBe("VALIDATION_ERROR");
    });

    it("POST with empty phone value returns 400", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: ["customers.write"],
      });
      const req = makePostRequest({
        name: "Valid Name",
        phones: [{ value: "" }],
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error?.code).toBe("VALIDATION_ERROR");
    });

    it("POST with content-length exceeding 100KB returns 413", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: [],
      });
      const req = makePostRequest(
        { name: "Big" },
        { contentLength: String(100 * 1024 + 1) }
      );
      const res = await POST(req);
      expect(res.status).toBe(413);
      const data = await res.json();
      expect(data.error?.code).toBe("PAYLOAD_TOO_LARGE");
    });
  });

  describe("Pagination", () => {
    it("GET respects limit and returns meta.total, meta.limit, meta.offset", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: [],
      });
      const req = makeGetRequest({ limit: "2", offset: "0" });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(2);
      expect(data.meta).toBeDefined();
      expect(data.meta.limit).toBe(2);
      expect(data.meta.offset).toBe(0);
      expect(typeof data.meta.total).toBe("number");
    });
  });

  describe("Audit", () => {
    it("POST creates customer.created audit event with request meta and no PII in metadata", async () => {
      (getAuthContext as jest.Mock).mockResolvedValue({
        userId: userReadWriteId,
        email: "read-write@step4.test",
        dealershipId: dealerAId,
        permissions: [],
      });
      const req = makePostRequest(
        {
          name: "Audit Test Customer " + Date.now(),
          status: "ACTIVE",
          phones: [{ value: "+15551234567", isPrimary: true }],
          emails: [{ value: "audit-pii@example.com", isPrimary: true }],
        },
        {}
      );
      const res = await POST(req);
      expect(res.status).toBe(201);
      const created = (await res.json()) as { data?: { id?: string } };
      const customerId = created.data?.id;
      expect(customerId).toBeDefined();

      const log = await prisma.auditLog.findFirst({
        where: {
          dealershipId: dealerAId,
          entity: "Customer",
          action: "customer.created",
          entityId: customerId,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(log).toBeDefined();
      expect(log?.actorId).toBe(userReadWriteId);
      const meta = log?.metadata as Record<string, unknown> | null;
      expect(meta?.customerId).toBe(customerId);
      expect(meta?.status).toBe("ACTIVE");
      expect(meta?.name).toBeUndefined();
      expect(meta?.email).toBeUndefined();
      expect(meta?.phone).toBeUndefined();
      expect(meta?.emails).toBeUndefined();
      expect(meta?.phones).toBeUndefined();
    });
  });
});
