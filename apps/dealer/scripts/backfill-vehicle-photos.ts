/**
 * One-time backfill: create VehiclePhoto rows for legacy FileObjects (inventory-photos, Vehicle) that have no VehiclePhoto.
 * Default: DRY RUN. Use --apply to mutate.
 * Run from repo root: npm -w apps/dealer run db:backfill-vehicle-photos -- [options]
 * Or from apps/dealer: npx tsx scripts/backfill-vehicle-photos.ts [options]
 * Requires: DATABASE_URL
 */
import {
  previewBackfillForDealership,
  runBackfillForDealership,
} from "@/modules/inventory/service/vehicle-photo-backfill";

function parseArgs(): {
  dryRun: boolean;
  dealershipId: string | null;
  limitVehicles: number;
  cursor: number;
} {
  const args = process.argv.slice(2);
  let dryRun = true;
  let dealershipId: string | null = null;
  let limitVehicles = 200;
  let cursor = 0;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--apply":
        dryRun = false;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--dealership":
        dealershipId = args[++i] ?? null;
        break;
      case "--limit-vehicles":
        limitVehicles = parseInt(args[++i] ?? "200", 10);
        break;
      case "--cursor":
        cursor = parseInt(args[++i] ?? "0", 10);
        break;
      default:
        if (args[i]!.startsWith("--")) {
          console.error(`Unknown option: ${args[i]}`);
          process.exit(1);
        }
    }
  }
  return { dryRun, dealershipId, limitVehicles, cursor };
}

async function main() {
  const { dryRun, dealershipId, limitVehicles, cursor } = parseArgs();

  if (!dryRun) {
    console.log("Apply mode: mutations will be written.");
  } else {
    console.log("DRY RUN (default). Use --apply to write changes.");
  }

  const actorUserId: string | null = null; // script run = system

  if (dealershipId) {
    if (dryRun) {
      const preview = await previewBackfillForDealership({
        dealershipId,
        limitVehicles,
        cursor,
      });
      console.log("\nPreview:");
      console.log(JSON.stringify({ dealershipId: preview.dealershipId, summary: preview.summary, nextOffset: preview.nextOffset }, null, 2));
      if (preview.vehicles.length > 0) {
        console.log("\nPer-vehicle (first 5):");
        preview.vehicles.slice(0, 5).forEach((v) => {
          console.log(`  vehicleId=${v.vehicleId} toCreate=${v.fileObjectIdsToCreate.length} skipped=${v.skippedCount} wouldSetPrimary=${v.wouldSetPrimary}`);
        });
      }
    } else {
      const result = await runBackfillForDealership(
        { dealershipId, limitVehicles, cursor, dryRun: false },
        actorUserId
      );
      console.log("\nResult:");
      console.log(JSON.stringify({ dealershipId: result.dealershipId, summary: result.summary, nextOffset: result.nextOffset }, null, 2));
      if (result.errors?.length) {
        console.error("Errors:", result.errors);
        process.exit(1);
      }
    }
  } else {
    console.error("--dealership <uuid> is required.");
    process.exit(1);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
