import * as valuationDb from "../db/valuation";
import * as vehicleDb from "../db/vehicle";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";

/** MOCK provider: returns valueCents e.g. 1500000 for $15k. */
function mockRequestValuation(_source: string): number {
  return 1500000; // $15,000
}

export type ListValuationsOptions = {
  limit?: number;
  offset?: number;
  source?: string;
};

export type RequestValuationInput = {
  source: "KBB" | "NADA" | "MOCK";
  condition?: string;
  odometer?: number;
};

export async function listValuations(
  dealershipId: string,
  vehicleId: string,
  options: ListValuationsOptions = {}
) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const limit = Math.min(options.limit ?? 20, 50);
  const offset = options.offset ?? 0;
  const [list, total] = await Promise.all([
    valuationDb.listByVehicleId(
      dealershipId,
      vehicleId,
      limit,
      offset,
      options.source
    ),
    valuationDb.getTotalByVehicleId(
      dealershipId,
      vehicleId,
      options.source
    ),
  ]);
  return { data: list, meta: { total, limit, offset } };
}

export async function requestValuation(
  dealershipId: string,
  vehicleId: string,
  userId: string,
  input: RequestValuationInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const valueCents = mockRequestValuation(input.source);
  const created = await valuationDb.createValuation({
    dealershipId,
    vehicleId,
    source: input.source,
    valueCents,
    condition: input.condition,
    odometer: input.odometer,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "vehicle_valuation.captured",
    entity: "VehicleValuation",
    entityId: created.id,
    metadata: {
      vehicleId,
      source: created.source,
      valueCents: created.valueCents,
      capturedAt: created.capturedAt.toISOString(),
    },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}
