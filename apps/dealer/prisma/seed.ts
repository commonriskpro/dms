import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PERMISSIONS: { key: string; description: string; module: string }[] = [
  { key: "admin.dealership.read", description: "View dealership and location settings", module: "admin" },
  { key: "admin.dealership.write", description: "Update dealership and locations", module: "admin" },
  { key: "admin.memberships.read", description: "List members, view membership details", module: "admin" },
  { key: "admin.memberships.write", description: "Invite, update role, disable member", module: "admin" },
  { key: "admin.roles.read", description: "List roles and their permissions", module: "admin" },
  { key: "admin.roles.write", description: "Create/update/delete roles, assign permissions", module: "admin" },
  { key: "admin.audit.read", description: "List and filter audit logs", module: "admin" },
  { key: "admin.permissions.read", description: "List global permission catalog", module: "admin" },
  { key: "inventory.read", description: "View vehicles and inventory data", module: "inventory" },
  { key: "inventory.write", description: "Create/update/delete vehicles, manage photos", module: "inventory" },
  { key: "customers.read", description: "View customer profiles and activity", module: "customers" },
  { key: "customers.write", description: "Create/update customers, notes, tasks", module: "customers" },
  { key: "deals.read", description: "View deals and deal structure", module: "deals" },
  { key: "deals.write", description: "Create/update deals, fees, trade-ins", module: "deals" },
  { key: "documents.read", description: "List file metadata, get signed URLs", module: "documents" },
  { key: "documents.write", description: "Upload, delete files; manage metadata", module: "documents" },
  { key: "finance.read", description: "View finance app shell, lender status", module: "finance" },
  { key: "finance.write", description: "Update finance app, submit to lender", module: "finance" },
  { key: "lenders.read", description: "View lender directory and submission metadata", module: "lender-integration" },
  { key: "lenders.write", description: "Create/update/disable lenders", module: "lender-integration" },
  { key: "finance.submissions.read", description: "View applications, submissions, decisions, stips, funding", module: "lender-integration" },
  { key: "finance.submissions.write", description: "Create/update applications, submissions, decisions, stips, funding", module: "lender-integration" },
  { key: "reports.read", description: "View sales, inventory, gross reports", module: "reports" },
  { key: "reports.export", description: "Export CSV/reports", module: "reports" },
  { key: "crm.read", description: "View pipelines, opportunities, automations, sequences", module: "crm" },
  { key: "crm.write", description: "Create/update pipelines, opportunities, automations, sequences", module: "crm" },
  { key: "bhph.read", description: "View BHPH contracts, ledger", module: "bhph" },
  { key: "bhph.write", description: "Manage BHPH contracts, payments", module: "bhph" },
  { key: "integrations.quickbooks.read", description: "View QuickBooks mapping and sync status", module: "integrations.quickbooks" },
  { key: "integrations.quickbooks.write", description: "Configure QuickBooks mapping, trigger sync", module: "integrations.quickbooks" },
  { key: "platform.admin.read", description: "View platform-level dealership list and members", module: "platform" },
  { key: "platform.admin.write", description: "Create/update/disable dealerships, manage members, impersonate", module: "platform" },
  { key: "platform.read", description: "List/get dealerships, members, roles; list invites and pending users; view cross-tenant audit", module: "platform" },
  { key: "platform.write", description: "Create/update/disable/enable dealerships; create/cancel invites; add/patch members; approve pending users", module: "platform" },
  { key: "platform.impersonate", description: "Start and end impersonation (set/clear active-dealership for target dealership)", module: "platform" },
];

const OWNER_KEYS = PERMISSIONS.map((p) => p.key);
const ADMIN_KEYS = PERMISSIONS.filter((k) => k.key !== "admin.roles.write").map((p) => p.key);
const SALES_KEYS = [
  "inventory.read", "inventory.write",
  "customers.read", "customers.write",
  "deals.read", "deals.write",
  "documents.read", "documents.write",
  "finance.read",
  "lenders.read",
  "finance.submissions.read",
  "reports.read",
  "crm.read", "crm.write",
];
const FINANCE_KEYS = [
  "inventory.read", "customers.read",
  "deals.read", "deals.write",
  "documents.read", "documents.write",
  "finance.read", "finance.write",
  "lenders.read", "lenders.write",
  "finance.submissions.read", "finance.submissions.write",
  "reports.read", "reports.export",
  "crm.read", "crm.write",
];

async function main() {
  console.log("Seeding permissions...");
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: { id: crypto.randomUUID(), key: p.key, description: p.description, module: p.module },
      update: { description: p.description, module: p.module },
    });
  }
  const permissionRecords = await prisma.permission.findMany();
  const keyToId = new Map(permissionRecords.map((r) => [r.key, r.id]));

  console.log("Creating demo dealership...");
  let dealership = await prisma.dealership.findFirst({ where: { slug: "demo" } });
  if (!dealership) {
    dealership = await prisma.dealership.create({
      data: {
        name: "Demo Dealership",
        slug: "demo",
        settings: { timezone: "America/New_York", currency: "USD" },
      },
    });
  }
  let location = await prisma.dealershipLocation.findFirst({
    where: { dealershipId: dealership.id, name: "Main Lot" },
  });
  if (!location) {
    location = await prisma.dealershipLocation.create({
      data: {
        dealershipId: dealership.id,
        name: "Main Lot",
        addressLine1: "123 Demo St",
        city: "Anytown",
        region: "NY",
        postalCode: "10001",
        country: "US",
        isPrimary: true,
      },
    });
  }

  console.log("Creating default roles...");
  const roleNames = [
    { name: "Owner", isSystem: true, keys: OWNER_KEYS },
    { name: "Admin", isSystem: true, keys: ADMIN_KEYS },
    { name: "Sales", isSystem: true, keys: SALES_KEYS },
    { name: "Finance", isSystem: true, keys: FINANCE_KEYS },
  ];

  for (const { name, isSystem, keys } of roleNames) {
    const existing = await prisma.role.findFirst({
      where: { dealershipId: dealership.id, name, deletedAt: null },
    });
    if (existing) {
      await prisma.rolePermission.deleteMany({ where: { roleId: existing.id } });
      await prisma.rolePermission.createMany({
        data: keys.map((key) => ({ roleId: existing.id, permissionId: keyToId.get(key)! })),
      });
      console.log(`  Updated role: ${name}`);
    } else {
      const role = await prisma.role.create({
        data: {
          dealershipId: dealership.id,
          name,
          isSystem,
          rolePermissions: {
            create: keys.map((key) => ({ permissionId: keyToId.get(key)! })),
          },
        },
      });
      console.log(`  Created role: ${name} (${role.id})`);
    }
  }

  const platformAdminEmails =
    process.env.SUPERADMIN_EMAILS ?? process.env.PLATFORM_ADMIN_EMAILS;
  if (platformAdminEmails && typeof platformAdminEmails === "string") {
    const emails = platformAdminEmails.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    for (const email of emails) {
      const profile = await prisma.profile.findUnique({ where: { email } });
      if (profile) {
        await prisma.platformAdmin.upsert({
          where: { userId: profile.id },
          create: { id: crypto.randomUUID(), userId: profile.id },
          update: {},
        });
        console.log("  Platform admin granted:", email);
      }
    }
  }

  console.log("Seed complete.");
  console.log("  Dealership id:", dealership.id);
  console.log("  Location id:", location.id);
  console.log("  To link the first user as Owner: sign in, then POST /api/admin/bootstrap-link-owner with a valid session.");
  if (platformAdminEmails) {
    console.log("  Platform admins: SUPERADMIN_EMAILS or PLATFORM_ADMIN_EMAILS (comma-separated).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
