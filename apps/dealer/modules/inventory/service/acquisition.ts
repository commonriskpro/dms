/**
 * Inventory acquisition pipeline: leads with stages NEW → CONTACTED → NEGOTIATING → WON | LOST.
 * Linked appraisalId must belong to same dealership.
 */
import * as acquisitionDb from "../db/acquisition";
import * as appraisalDb from "../db/appraisal";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { InventorySourceLeadStatus } from "@prisma/client";

export type AcquisitionListOptions = acquisitionDb.AcquisitionListOptions;
export type InventorySourceLeadCreateInput = acquisitionDb.InventorySourceLeadCreateInput;
export type InventorySourceLeadUpdateInput = acquisitionDb.InventorySourceLeadUpdateInput;

const VALID_STAGES: InventorySourceLeadStatus[] = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"];

export async function listInventorySourceLeads(dealershipId: string, options: acquisitionDb.AcquisitionListOptions) {
  await requireTenantActiveForRead(dealershipId);
  return acquisitionDb.listInventorySourceLeads(dealershipId, options);
}

export async function getInventorySourceLead(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const row = await acquisitionDb.getInventorySourceLeadById(dealershipId, id);
  if (!row) throw new ApiError("NOT_FOUND", "Acquisition lead not found");
  return row;
}

export async function createInventorySourceLead(dealershipId: string, data: acquisitionDb.InventorySourceLeadCreateInput) {
  await requireTenantActiveForWrite(dealershipId);
  const vin = data.vin?.trim();
  if (!vin || vin.length > 17) throw new ApiError("VALIDATION_ERROR", "VIN required (max 17 chars)");
  if (data.appraisalId) {
    const appraisal = await appraisalDb.getAppraisalById(dealershipId, data.appraisalId);
    if (!appraisal) throw new ApiError("VALIDATION_ERROR", "Appraisal not found or not in this dealership");
  }
  return acquisitionDb.createInventorySourceLead(dealershipId, { ...data, vin });
}

export async function updateInventorySourceLead(
  dealershipId: string,
  id: string,
  data: acquisitionDb.InventorySourceLeadUpdateInput
) {
  await requireTenantActiveForWrite(dealershipId);
  if (data.appraisalId !== undefined) {
    if (data.appraisalId !== null) {
      const appraisal = await appraisalDb.getAppraisalById(dealershipId, data.appraisalId);
      if (!appraisal) throw new ApiError("VALIDATION_ERROR", "Appraisal not found or not in this dealership");
    }
  }
  const updated = await acquisitionDb.updateInventorySourceLead(dealershipId, id, data);
  if (!updated) throw new ApiError("NOT_FOUND", "Acquisition lead not found");
  return updated;
}

export async function moveInventorySourceLeadStage(
  dealershipId: string,
  id: string,
  status: InventorySourceLeadStatus
) {
  await requireTenantActiveForWrite(dealershipId);
  if (!VALID_STAGES.includes(status)) throw new ApiError("VALIDATION_ERROR", "Invalid stage");
  const updated = await acquisitionDb.setInventorySourceLeadStatus(dealershipId, id, status);
  if (!updated) throw new ApiError("NOT_FOUND", "Acquisition lead not found");
  return updated;
}
