import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PERMISSIONS: { key: string; description: string; module: string }[] = [
  // Legacy / existing
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
  // Canonical DealerCenter keys (RBAC_DEALERCENTER_SPEC)
  { key: "inventory.create", description: "Create vehicles", module: "inventory" },
  { key: "inventory.update", description: "Update vehicles", module: "inventory" },
  { key: "inventory.delete", description: "Delete vehicles", module: "inventory" },
  { key: "inventory.export", description: "Export inventory", module: "inventory" },
  { key: "inventory.appraisals.read", description: "View appraisals", module: "inventory" },
  { key: "inventory.appraisals.write", description: "Create/update/approve/reject/convert appraisals", module: "inventory" },
  { key: "inventory.acquisition.read", description: "View acquisition pipeline", module: "inventory" },
  { key: "inventory.acquisition.write", description: "Create/update leads, move stages", module: "inventory" },
  { key: "inventory.auctions.read", description: "Search and view auction listings", module: "inventory" },
  { key: "inventory.pricing.read", description: "View pricing rules and preview", module: "inventory" },
  { key: "inventory.pricing.write", description: "Create/update rules, recalc valuation, apply pricing", module: "inventory" },
  { key: "inventory.publish.read", description: "View listing status per vehicle", module: "inventory" },
  { key: "inventory.publish.write", description: "Publish/unpublish listings", module: "inventory" },
  { key: "customers.create", description: "Create customers", module: "customers" },
  { key: "customers.update", description: "Update customers", module: "customers" },
  { key: "customers.delete", description: "Delete customers", module: "customers" },
  { key: "customers.export", description: "Export customers", module: "customers" },
  { key: "crm.create", description: "Create CRM records", module: "crm" },
  { key: "crm.update", description: "Update CRM records", module: "crm" },
  { key: "crm.delete", description: "Delete CRM records", module: "crm" },
  { key: "crm.export", description: "Export CRM data", module: "crm" },
  { key: "deals.create", description: "Create deals", module: "deals" },
  { key: "deals.update", description: "Update deals", module: "deals" },
  { key: "deals.delete", description: "Delete deals", module: "deals" },
  { key: "deals.export", description: "Export deals", module: "deals" },
  { key: "deals.approve", description: "Approve deals", module: "deals" },
  { key: "appointments.read", description: "View appointments", module: "appointments" },
  { key: "appointments.create", description: "Create appointments", module: "appointments" },
  { key: "appointments.update", description: "Update appointments", module: "appointments" },
  { key: "appointments.cancel", description: "Cancel appointments", module: "appointments" },
  { key: "finance.update", description: "Update finance data", module: "finance" },
  { key: "finance.approve", description: "Approve finance", module: "finance" },
  { key: "admin.users.read", description: "List and view users", module: "admin" },
  { key: "admin.users.invite", description: "Invite users", module: "admin" },
  { key: "admin.users.update", description: "Update user profile/roles", module: "admin" },
  { key: "admin.users.disable", description: "Disable users", module: "admin" },
  { key: "admin.roles.assign", description: "Assign roles to users", module: "admin" },
  { key: "admin.permissions.manage", description: "Manage per-user permission overrides", module: "admin" },
  { key: "admin.settings.manage", description: "Manage dealership settings", module: "admin" },
  { key: "integrations.read", description: "View integrations", module: "integrations" },
  { key: "integrations.manage", description: "Manage integrations", module: "integrations" },
  { key: "audit.read", description: "Read audit logs", module: "audit" },
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

/** DealerCenter role templates: key -> permission keys (deterministic seed) */
const ROLE_TEMPLATES: { key: string; name: string; permissionKeys: string[] }[] = [
  {
    key: "SALES_ASSOCIATE",
    name: "Sales Associate",
    permissionKeys: [
      "customers.read", "customers.create", "customers.update",
      "crm.read", "crm.create", "crm.update",
      "deals.read", "deals.create", "deals.update",
      "appointments.read", "appointments.create", "appointments.update", "appointments.cancel",
    ],
  },
  {
    key: "SALES_MANAGER",
    name: "Sales Manager",
    permissionKeys: [
      "customers.read", "customers.create", "customers.update", "customers.delete", "customers.export",
      "crm.read", "crm.create", "crm.update", "crm.delete", "crm.export",
      "deals.read", "deals.create", "deals.update", "deals.delete", "deals.export", "deals.approve",
      "appointments.read", "appointments.create", "appointments.update", "appointments.cancel",
      "reports.read", "reports.export",
      ...SALES_KEYS.filter((k) => !["reports.read", "reports.export"].includes(k)),
    ].filter((v, i, a) => a.indexOf(v) === i),
  },
  {
    key: "ACCOUNTING",
    name: "Accounting",
    permissionKeys: [
      "deals.read", "deals.export",
      "finance.read", "finance.update",
      "reports.read", "reports.export",
      "audit.read",
    ],
  },
  {
    key: "ADMIN_ASSISTANT",
    name: "Admin Assistant",
    permissionKeys: [
      "customers.read", "customers.create", "customers.update",
      "appointments.read", "appointments.create", "appointments.update", "appointments.cancel",
      "crm.read", "crm.create",
      "deals.read",
    ],
  },
  {
    key: "INVENTORY_MANAGER",
    name: "Inventory Manager",
    permissionKeys: [
      "inventory.read", "inventory.create", "inventory.update", "inventory.delete", "inventory.export",
      "deals.read",
      "reports.read",
    ],
  },
  {
    key: "DEALER_ADMIN",
    name: "Dealer Admin",
    permissionKeys: [
      ...PERMISSIONS.filter((p) =>
        p.key.startsWith("admin.") || p.key.startsWith("integrations.") || p.key === "audit.read"
      ).map((p) => p.key),
      "inventory.read", "inventory.create", "inventory.update", "inventory.delete", "inventory.export",
      "customers.read", "customers.create", "customers.update", "customers.delete", "customers.export",
      "crm.read", "crm.create", "crm.update", "crm.delete", "crm.export",
      "deals.read", "deals.create", "deals.update", "deals.delete", "deals.export", "deals.approve",
      "appointments.read", "appointments.create", "appointments.update", "appointments.cancel",
      "finance.read", "finance.update", "finance.approve",
      "reports.read", "reports.export",
      "admin.dealership.read", "admin.dealership.write",
      "admin.memberships.read", "admin.memberships.write",
      "admin.roles.read", "admin.roles.write",
      "admin.audit.read", "admin.permissions.read",
    ].filter((v, i, a) => a.indexOf(v) === i),
  },
  {
    key: "OWNER",
    name: "Owner",
    permissionKeys: [...OWNER_KEYS],
  },
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

  console.log("Creating DealerCenter role templates...");
  for (const template of ROLE_TEMPLATES) {
    const existing = await prisma.role.findFirst({
      where: { dealershipId: dealership.id, key: template.key, deletedAt: null },
    });
    const permIds = template.permissionKeys.map((k) => keyToId.get(k)).filter(Boolean) as string[];
    if (existing) {
      await prisma.rolePermission.deleteMany({ where: { roleId: existing.id } });
      if (permIds.length) {
        await prisma.rolePermission.createMany({
          data: permIds.map((permissionId) => ({ roleId: existing.id, permissionId })),
        });
      }
      console.log(`  Updated template: ${template.key}`);
    } else {
      const role = await prisma.role.create({
        data: {
          dealershipId: dealership.id,
          key: template.key,
          name: template.name,
          isSystem: true,
          rolePermissions: {
            create: permIds.map((permissionId) => ({ permissionId })),
          },
        },
      });
      console.log(`  Created template: ${template.key} (${role.id})`);
    }
  }

  console.log("Backfilling UserRole from Memberships...");
  const memberships = await prisma.membership.findMany({ where: { disabledAt: null } });
  for (const m of memberships) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: m.userId, roleId: m.roleId } },
      create: { userId: m.userId, roleId: m.roleId },
      update: {},
    });
  }
  console.log(`  Synced ${memberships.length} user-role links.`);

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
