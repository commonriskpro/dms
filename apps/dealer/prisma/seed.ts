import { PrismaClient } from "@prisma/client";
import {
  DEALER_PERMISSION_CATALOG,
  DEALERCENTER_ROLE_TEMPLATES,
  DEFAULT_SYSTEM_ROLE_KEYS,
} from "../lib/constants/permissions";

const prisma = new PrismaClient();

const PERMISSIONS = DEALER_PERMISSION_CATALOG;
const OWNER_KEYS = DEFAULT_SYSTEM_ROLE_KEYS.Owner;
const ADMIN_KEYS = DEFAULT_SYSTEM_ROLE_KEYS.Admin;
const SALES_KEYS = DEFAULT_SYSTEM_ROLE_KEYS.Sales;
const FINANCE_KEYS = DEFAULT_SYSTEM_ROLE_KEYS.Finance;
const ROLE_TEMPLATES = DEALERCENTER_ROLE_TEMPLATES;

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

  console.log("Seed complete.");
  console.log("  Dealership id:", dealership.id);
  console.log("  Location id:", location.id);
  console.log("  To link the first user as Owner: sign in, then POST /api/admin/bootstrap-link-owner with a valid session.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
