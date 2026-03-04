/**
 * Dedupe VINs per dealership before applying migration 20250303000000_inventory_vehicle_lifecycle_costs.
 * For each (dealershipId, vin) with multiple vehicles, keeps the newest (by createdAt) and sets vin = null on older rows.
 * Run: npx tsx scripts/dedupe-vins.ts
 * Requires: DATABASE_URL
 */
import { prisma } from "@/lib/db";

type ChangeLog = {
  dealershipId: string;
  vin: string;
  keptVehicleId: string;
  nulledVehicleIds: string[];
};

type DupeGroup = {
  dealershipId: string;
  vin: string;
  vehicles: { id: string; createdAt: Date }[];
};

async function findDuplicateVins(): Promise<DupeGroup[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: {
      vin: { not: null },
      deletedAt: null,
    },
    select: { id: true, dealershipId: true, vin: true, createdAt: true },
    orderBy: [{ dealershipId: "asc" }, { vin: "asc" }, { createdAt: "desc" }],
  });
  const key = (d: string, v: string) => `${d}\t${v}`;
  const map = new Map<string, { id: string; createdAt: Date }[]>();
  const keyToMeta = new Map<string, { dealershipId: string; vin: string }>();
  for (const v of vehicles) {
    const vin = v.vin!.trim();
    if (!vin) continue;
    const k = key(v.dealershipId, vin);
    keyToMeta.set(k, { dealershipId: v.dealershipId, vin });
    const list = map.get(k) ?? [];
    list.push({ id: v.id, createdAt: v.createdAt });
    map.set(k, list);
  }
  const groups: DupeGroup[] = [];
  for (const [k, list] of map) {
    if (list.length <= 1) continue;
    const meta = keyToMeta.get(k)!;
    groups.push({ dealershipId: meta.dealershipId, vin: meta.vin, vehicles: list });
  }
  return groups;
}

async function runDedupe(): Promise<ChangeLog[]> {
  const groups = await findDuplicateVins();
  const logs: ChangeLog[] = [];
  for (const g of groups) {
    const [kept, ...toNull] = g.vehicles;
    for (const { id } of toNull) {
      await prisma.vehicle.update({
        where: { id },
        data: { vin: null },
      });
    }
    logs.push({
      dealershipId: g.dealershipId,
      vin: g.vin,
      keptVehicleId: kept.id,
      nulledVehicleIds: toNull.map((x) => x.id),
    });
  }
  return logs;
}

async function main() {
  const groups = await findDuplicateVins();
  if (groups.length === 0) {
    console.log("No duplicate VINs per dealership found. Nothing to do.");
    process.exit(0);
  }
  console.log(`Found ${groups.length} (dealershipId, vin) group(s) with duplicates.`);
  const logs = await runDedupe();
  console.log("Changes applied:");
  for (const log of logs) {
    console.log(
      `  dealershipId=${log.dealershipId} vin=${log.vin} keptVehicleId=${log.keptVehicleId} nulledVehicleIds=[${log.nulledVehicleIds.join(", ")}]`
    );
  }
  console.log(`Done. Nulled VIN on ${logs.reduce((s, l) => s + l.nulledVehicleIds.length, 0)} vehicle(s).`);
  process.exit(0);
}

// Export for tests (integration test can call runDedupe without main).
export { findDuplicateVins, runDedupe };

// Run main only when executed as script (not when imported by tests).
const isScript = process.argv[1]?.includes("dedupe-vins");
if (isScript) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
