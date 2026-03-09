/**
 * Report or delete legacy-only vehicle FileObjects (inventory-photos, Vehicle, no VehiclePhoto).
 * Default: DRY RUN (report only). Use --apply to soft-delete; requires --actor-user-id for audit.
 * Run from apps/dealer: npx tsx scripts/cleanup-legacy-vehicle-fileobjects.ts [options]
 * Requires: DATABASE_URL
 */
import { prisma } from "@/lib/db";
import * as vehiclePhotoDb from "@/modules/inventory/db/vehicle-photo";
import { auditLog } from "@/lib/audit";

const BATCH = 100;

function parseArgs(): {
  apply: boolean;
  dealershipId: string | null;
  actorUserId: string | null;
} {
  const args = process.argv.slice(2);
  let apply = false;
  let dealershipId: string | null = null;
  let actorUserId: string | null = null;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--apply":
        apply = true;
        break;
      case "--dealership":
        dealershipId = args[++i] ?? null;
        break;
      case "--actor-user-id":
        actorUserId = args[++i] ?? null;
        break;
      default:
        if (args[i]?.startsWith("--")) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }
  return { apply, dealershipId, actorUserId };
}

async function main() {
  const { apply, dealershipId, actorUserId } = parseArgs();

  if (apply && !actorUserId) {
    console.error("--apply requires --actor-user-id <uuid> for audit.");
    process.exit(1);
  }

  if (!dealershipId) {
    console.error("--dealership <uuid> is required.");
    process.exit(1);
  }

  if (apply) {
    console.log("Apply mode: legacy-only FileObjects will be soft-deleted.");
  } else {
    console.log("DRY RUN (default). Use --apply and --actor-user-id to delete.");
  }

  let offset = 0;
  let totalReported = 0;
  let totalDeleted = 0;

  while (true) {
    const { ids, total } = await vehiclePhotoDb.listLegacyOnlyVehicleFileObjectIds(
      dealershipId,
      BATCH,
      offset
    );
    if (offset === 0) {
      console.log(`Legacy-only FileObjects for dealership ${dealershipId}: ${total}`);
    }
    if (ids.length === 0) break;
    totalReported += ids.length;
    for (const fileId of ids) {
      if (apply && actorUserId) {
        const file = await prisma.fileObject.findFirst({
          where: { id: fileId, dealershipId, deletedAt: null },
          select: { id: true, bucket: true, entityId: true },
        });
        if (!file) continue;
        await prisma.fileObject.update({
          where: { id: fileId },
          data: { deletedAt: new Date(), deletedBy: actorUserId },
        });
        await auditLog({
          dealershipId,
          actorUserId,
          action: "file.legacy_cleanup_deleted",
          entity: "FileObject",
          entityId: fileId,
          metadata: { bucket: file.bucket, vehicleId: file.entityId },
        });
        totalDeleted++;
      }
    }
    offset += BATCH;
    if (ids.length < BATCH) break;
  }

  console.log(`Reported: ${totalReported} legacy-only file(s).`);
  if (apply) console.log(`Deleted: ${totalDeleted} file(s).`);
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
