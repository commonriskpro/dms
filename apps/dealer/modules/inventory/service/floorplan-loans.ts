import * as floorplanLoanDb from "../db/floorplan-loan";
import * as vehicleDb from "../db/vehicle";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { FloorplanLoanStatus } from "@prisma/client";

export type FloorplanLoanInput = {
  lender: string;
  principalCents: number;
  interestBps?: number | null;
  startDate: Date;
  curtailmentDate?: Date | null;
  notes?: string | null;
};

export async function getFloorplanLoan(
  dealershipId: string,
  vehicleId: string,
  options?: { includeHistory?: boolean }
) {
  await requireTenantActiveForRead(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const loans = await floorplanLoanDb.listByVehicleId(dealershipId, vehicleId, options);
  return loans;
}

export async function createOrUpdateFloorplanLoan(
  dealershipId: string,
  vehicleId: string,
  data: FloorplanLoanInput,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const vehicle = await vehicleDb.getVehicleById(dealershipId, vehicleId);
  if (!vehicle) throw new ApiError("NOT_FOUND", "Vehicle not found");
  const active = await floorplanLoanDb.getActiveByVehicleId(dealershipId, vehicleId);
  const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
  const curtailmentDate =
    data.curtailmentDate != null
      ? data.curtailmentDate instanceof Date
        ? data.curtailmentDate
        : new Date(data.curtailmentDate)
      : undefined;
  if (active) {
    const updated = await floorplanLoanDb.updateFloorplanLoan(dealershipId, active.id, {
      lender: data.lender,
      principalCents: data.principalCents,
      interestBps: data.interestBps ?? null,
      startDate,
      curtailmentDate: curtailmentDate ?? null,
      notes: data.notes ?? null,
    });
    if (!updated) throw new ApiError("NOT_FOUND", "Floorplan loan not found");
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "FloorplanLoan.updated",
      entity: "FloorplanLoan",
      entityId: active.id,
      metadata: { vehicleId, principalCents: data.principalCents },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return updated;
  }
  const created = await floorplanLoanDb.createFloorplanLoan({
    dealershipId,
    vehicleId,
    lender: data.lender,
    principalCents: data.principalCents,
    interestBps: data.interestBps ?? null,
    startDate,
    curtailmentDate: curtailmentDate ?? null,
    status: "ACTIVE",
    notes: data.notes ?? null,
  });
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "FloorplanLoan.created",
    entity: "FloorplanLoan",
    entityId: created.id,
    metadata: { vehicleId, principalCents: data.principalCents },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return created;
}

export async function markFloorplanStatus(
  dealershipId: string,
  floorplanLoanId: string,
  status: FloorplanLoanStatus,
  userId: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await floorplanLoanDb.getById(dealershipId, floorplanLoanId);
  if (!existing) throw new ApiError("NOT_FOUND", "Floorplan loan not found");
  const updated = await floorplanLoanDb.updateFloorplanLoan(dealershipId, floorplanLoanId, { status });
  if (!updated) throw new ApiError("NOT_FOUND", "Floorplan loan not found");
  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "FloorplanLoan.status_changed",
    entity: "FloorplanLoan",
    entityId: floorplanLoanId,
    metadata: { vehicleId: existing.vehicleId, status },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  return updated;
}

/**
 * Simple daily interest: principal * (bps/10000) * days/365.
 * Returns integer cents (rounded); deterministic, no floats in storage.
 */
export function calculateAccruedInterestCents(
  principalCents: number,
  interestBps: number,
  startDate: Date,
  asOfDate: Date
): number {
  if (interestBps <= 0) return 0;
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const asOf = new Date(asOfDate);
  asOf.setHours(0, 0, 0, 0);
  const diffMs = asOf.getTime() - start.getTime();
  const days = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  // principalCents * (interestBps/10000) * (days/365) => cents
  const interestCents = Math.round((principalCents * interestBps * days) / (10000 * 365));
  return interestCents;
}
