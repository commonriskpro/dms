/**
 * Delete all users (profiles and user-scoped data) from the dealer DB.
 * Use for resetting to a baseline (e.g. before re-seeding). Does not touch Supabase Auth.
 *
 * Run from repo root: npm run db:delete-users
 * Or from apps/dealer: dotenv -e ../../.env.local -- npx tsx scripts/delete-all-users.ts
 *
 * Order respects FKs: clear Restrict refs first, then delete Profile (cascades do the rest).
 */

import { prisma } from "@/lib/db";

async function main() {
  console.log("[delete-all-users] Starting…");

  const u1 = await prisma.userPermissionOverride.deleteMany({});
  console.log("[delete-all-users] Deleted UserPermissionOverride:", u1.count);

  const u2 = await prisma.role.updateMany({
    data: { deletedBy: null },
    where: { deletedBy: { not: null } },
  });
  console.log("[delete-all-users] Cleared Role.deletedBy:", u2.count);

  const u3 = await prisma.financeApplication.updateMany({
    data: { createdBy: null },
    where: { createdBy: { not: null } },
  });
  console.log("[delete-all-users] Cleared FinanceApplication.createdBy:", u3.count);

  const u4 = await prisma.vehicleCostEntry.deleteMany({});
  console.log("[delete-all-users] Deleted VehicleCostEntry:", u4.count);

  const u5 = await prisma.customerTask.deleteMany({});
  console.log("[delete-all-users] Deleted CustomerTask:", u5.count);

  const u5b = await prisma.inboxMessageAttachment.deleteMany({});
  console.log("[delete-all-users] Deleted InboxMessageAttachment:", u5b.count);

  const u6 = await prisma.fileObject.deleteMany({});
  console.log("[delete-all-users] Deleted FileObject:", u6.count);

  const u7 = await prisma.profile.deleteMany({});
  console.log("[delete-all-users] Deleted Profile:", u7.count);

  console.log("[delete-all-users] Done. All users removed from dealer DB.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
