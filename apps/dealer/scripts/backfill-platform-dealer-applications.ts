/**
 * Backfill existing dealer applications into the platform canonical store.
 * Run from repo root: dotenv -e .env.local -- npm --prefix apps/dealer run db:backfill-platform-dealer-applications
 */

import path from "path";
import fs from "fs";

function loadEnvLocal(): void {
  const cwd = process.cwd();
  const root = cwd.endsWith("apps/dealer") || cwd.includes("apps/dealer") ? path.resolve(cwd, "../..") : cwd;
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();

async function main() {
  const [{ prisma }, { syncPlatformDealerApplication }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/call-platform-internal"),
  ]);

  const pageSize = 100;
  let offset = 0;
  let synced = 0;

  while (true) {
    const batch = await prisma.dealerApplication.findMany({
      orderBy: [{ createdAt: "asc" }],
      take: pageSize,
      skip: offset,
      include: { profile: true },
    });
    if (batch.length === 0) break;

    for (const app of batch) {
      const result = await syncPlatformDealerApplication({
        dealerApplicationId: app.id,
        source: app.source,
        status: app.status,
        ownerEmail: app.ownerEmail,
        dealerInviteId: app.inviteId ?? null,
        invitedByUserId: app.invitedByUserId ?? null,
        dealerDealershipId: app.dealershipId ?? null,
        platformApplicationId: app.platformApplicationId ?? null,
        platformDealershipId: app.platformDealershipId ?? null,
        submittedAt: app.submittedAt?.toISOString() ?? null,
        approvedAt: app.approvedAt?.toISOString() ?? null,
        rejectedAt: app.rejectedAt?.toISOString() ?? null,
        activationSentAt: app.activationSentAt?.toISOString() ?? null,
        activatedAt: app.activatedAt?.toISOString() ?? null,
        reviewerUserId: app.reviewerUserId ?? null,
        reviewNotes: app.reviewNotes ?? null,
        rejectionReason: app.rejectionReason ?? null,
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
        profile: app.profile
          ? {
              businessInfo: (app.profile.businessInfo as Record<string, unknown> | null) ?? null,
              ownerInfo: (app.profile.ownerInfo as Record<string, unknown> | null) ?? null,
              primaryContact: (app.profile.primaryContact as Record<string, unknown> | null) ?? null,
              additionalLocations: app.profile.additionalLocations ?? null,
              pricingPackageInterest:
                (app.profile.pricingPackageInterest as Record<string, unknown> | null) ?? null,
              acknowledgments: (app.profile.acknowledgments as Record<string, unknown> | null) ?? null,
            }
          : null,
      });

      if (!result.ok) {
        throw new Error(
          `Failed to sync dealer application ${app.id}: ${result.error.status} ${result.error.message}`
        );
      }
      synced += 1;
    }

    offset += batch.length;
    console.log(`Backfilled ${synced} dealer application(s)...`);
  }

  console.log(`Backfill complete. Synced ${synced} dealer application(s).`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$disconnect();
  } catch {
    // ignore cleanup errors
  }
  process.exit(1);
});
