import * as lenderStipulationDb from "../db/lender-stipulation";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import * as lenderApplicationService from "./lender-application";

export async function listStipulations(dealershipId: string, lenderApplicationId: string) {
  await requireTenantActiveForRead(dealershipId);
  await lenderApplicationService.getLenderApplication(dealershipId, lenderApplicationId);
  return lenderStipulationDb.listLenderStipulationsByLenderApplicationId(
    dealershipId,
    lenderApplicationId
  );
}

export async function createStipulation(
  dealershipId: string,
  userId: string,
  data: {
    lenderApplicationId: string;
    type: "PROOF_OF_INCOME" | "DRIVER_LICENSE" | "RESIDENCE_PROOF" | "INSURANCE" | "REFERENCES" | "OTHER";
    title: string;
    notes?: string | null;
    requiredAt?: string | null;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  await lenderApplicationService.getLenderApplication(dealershipId, data.lenderApplicationId);

  const created = await lenderStipulationDb.createLenderStipulation({
    dealershipId,
    lenderApplicationId: data.lenderApplicationId,
    type: data.type,
    title: data.title,
    notes: data.notes ?? null,
    requiredAt: data.requiredAt ? new Date(data.requiredAt) : null,
    createdByUserId: userId,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "lender_stipulation.created",
    entity: "LenderStipulation",
    entityId: created.id,
    metadata: { lenderApplicationId: data.lenderApplicationId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return created;
}

export async function updateStipulation(
  dealershipId: string,
  userId: string,
  id: string,
  data: lenderStipulationDb.LenderStipulationUpdateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await lenderStipulationDb.getLenderStipulationById(dealershipId, id);
  if (!existing) throw new ApiError("NOT_FOUND", "Stipulation not found");

  const updated = await lenderStipulationDb.updateLenderStipulation(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Stipulation not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "lender_stipulation.updated",
    entity: "LenderStipulation",
    entityId: id,
    metadata: { changedFields: Object.keys(data) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}
