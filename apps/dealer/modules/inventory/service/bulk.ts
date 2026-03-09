/**
 * Bulk import (CSV) and bulk update for inventory.
 * Tenant-scoped; dealershipId from auth only.
 */
import * as vehicleDb from "../db/vehicle";
import * as bulkJobDb from "../db/bulk-import-job";
import * as vehicleService from "./vehicle";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import { emitEvent } from "@/lib/infrastructure/events/eventBus";
import type { VehicleStatus } from "@prisma/client";

const MAX_IMPORT_FILE_BYTES = 1024 * 1024; // 1MB
const MAX_IMPORT_ROWS = 500;
const MAX_BULK_UPDATE_IDS = 50;

const VEHICLE_STATUSES = new Set<VehicleStatus>([
  "AVAILABLE",
  "HOLD",
  "SOLD",
  "WHOLESALE",
  "REPAIR",
  "ARCHIVED",
]);

export type PreviewRowError = { row: number; field?: string; message: string };

/** Parse CSV text into rows (array of string[]). Handles quoted fields. */
export function parseCsvToRows(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells: string[] = [];
    let pos = 0;
    while (pos < line.length) {
      if (line[pos] === '"') {
        let end = pos + 1;
        let s = "";
        while (end < line.length) {
          if (line[end] === '"') {
            if (line[end + 1] === '"') {
              s += '"';
              end += 2;
            } else {
              end++;
              break;
            }
          } else {
            s += line[end];
            end++;
          }
        }
        cells.push(s);
        pos = end;
        if (line[pos] === ",") pos++;
      } else {
        const comma = line.indexOf(",", pos);
        const value = comma === -1 ? line.slice(pos).trim() : line.slice(pos, comma).trim();
        cells.push(value.replace(/^"|"$/g, ""));
        pos = comma === -1 ? line.length : comma + 1;
      }
    }
    rows.push(cells);
  }
  return rows;
}

/** Expected CSV header: stockNumber,vin,status,salePriceCents (order matters for preview/apply). */
const EXPECTED_HEADER = ["stockNumber", "vin", "status", "salePriceCents"];

function normalizeHeader(cells: string[]): string[] {
  return cells.map((c) => c.trim().toLowerCase().replace(/\s+/g, ""));
}

export type ImportPreviewResult = {
  valid: boolean;
  totalRows: number;
  errors: PreviewRowError[];
};

export async function previewBulkImport(
  dealershipId: string,
  fileContent: string
): Promise<ImportPreviewResult> {
  await requireTenantActiveForWrite(dealershipId);
  if (Buffer.byteLength(fileContent, "utf8") > MAX_IMPORT_FILE_BYTES) {
    throw new ApiError("VALIDATION_ERROR", "File too large (max 1MB)");
  }
  const rows = parseCsvToRows(fileContent);
  if (rows.length === 0) {
    return { valid: true, totalRows: 0, errors: [] };
  }
  const header = normalizeHeader(rows[0]);
  const stockNumberIdx = header.indexOf("stocknumber");
  const vinIdx = header.indexOf("vin");
  const statusIdx = header.indexOf("status");
  const salePriceIdx = header.indexOf("salepricecents");
  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ApiError("VALIDATION_ERROR", `Max ${MAX_IMPORT_ROWS} rows per file`);
  }
  const errors: PreviewRowError[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2;
    const cells = dataRows[i];
    if (stockNumberIdx >= 0) {
      const stock = cells[stockNumberIdx]?.trim();
      if (!stock) errors.push({ row: rowNum, field: "stockNumber", message: "stockNumber is required" });
    } else {
      errors.push({ row: rowNum, message: "Missing stockNumber column" });
    }
    if (vinIdx >= 0 && cells[vinIdx]) {
      const vin = cells[vinIdx].trim();
      if (vin.length < 8 || vin.length > 17) {
        errors.push({ row: rowNum, field: "vin", message: "VIN must be 8–17 characters" });
      }
    }
    if (statusIdx >= 0 && cells[statusIdx]) {
      const s = cells[statusIdx].trim().toUpperCase();
      if (!VEHICLE_STATUSES.has(s as VehicleStatus)) {
        errors.push({ row: rowNum, field: "status", message: `Invalid status; allowed: ${[...VEHICLE_STATUSES].join(", ")}` });
      }
    }
    if (salePriceIdx >= 0 && cells[salePriceIdx]) {
      const n = Number(cells[salePriceIdx]);
      if (Number.isNaN(n) || n < 0) {
        errors.push({ row: rowNum, field: "salePriceCents", message: "salePriceCents must be a non-negative number" });
      }
    }
  }
  return {
    valid: errors.length === 0,
    totalRows: dataRows.length,
    errors,
  };
}

export async function applyBulkImport(
  dealershipId: string,
  userId: string,
  fileContent: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ jobId: string; status: "PENDING" | "RUNNING" }> {
  await requireTenantActiveForWrite(dealershipId);
  if (Buffer.byteLength(fileContent, "utf8") > MAX_IMPORT_FILE_BYTES) {
    throw new ApiError("VALIDATION_ERROR", "File too large (max 1MB)");
  }
  const rows = parseCsvToRows(fileContent);
  const dataRows = rows.length <= 1 ? [] : rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ApiError("VALIDATION_ERROR", `Max ${MAX_IMPORT_ROWS} rows per file`);
  }
  const header = rows[0] ? normalizeHeader(rows[0]) : [];
  const stockNumberIdx = header.indexOf("stocknumber");
  const vinIdx = header.indexOf("vin");
  const statusIdx = header.indexOf("status");
  const salePriceIdx = header.indexOf("salepricecents");

  const job = await bulkJobDb.createBulkImportJob({
    dealershipId,
    status: "RUNNING",
    totalRows: dataRows.length,
    createdBy: userId,
  });

  emitEvent("bulk_import.requested", {
    dealershipId,
    importId: job.id,
    rowCount: dataRows.length,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "bulk_import_job.created",
    entity: "BulkImportJob",
    entityId: job.id,
    metadata: { jobId: job.id, totalRows: dataRows.length },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  const errors: Array<{ row?: number; message: string }> = [];
  let processed = 0;
  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i];
    const stockNumber = stockNumberIdx >= 0 ? cells[stockNumberIdx]?.trim() : "";
    if (!stockNumber) {
      errors.push({ row: i + 2, message: "stockNumber is required" });
      processed++;
      continue;
    }
    const vin = vinIdx >= 0 ? cells[vinIdx]?.trim() || undefined : undefined;
    const statusStr = statusIdx >= 0 ? cells[statusIdx]?.trim() : "";
    const status = statusStr && VEHICLE_STATUSES.has(statusStr as VehicleStatus) ? (statusStr as VehicleStatus) : undefined;
    let salePriceCents: bigint | undefined;
    if (salePriceIdx >= 0 && cells[salePriceIdx]) {
      const n = Number(cells[salePriceIdx]);
      if (!Number.isNaN(n) && n >= 0) salePriceCents = BigInt(Math.round(n));
    }
    try {
      await vehicleService.createVehicle(
        dealershipId,
        userId,
        {
          stockNumber,
          vin,
          status,
          salePriceCents,
        },
        meta
      );
      processed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      errors.push({ row: i + 2, message: msg });
      processed++;
    }
    await bulkJobDb.updateBulkImportJob(dealershipId, job.id, {
      processedRows: processed,
      errorsJson: errors.length > 0 ? errors : null,
    });
  }

  const completedAt = new Date();
  await bulkJobDb.updateBulkImportJob(dealershipId, job.id, {
    status: errors.length === dataRows.length ? "FAILED" : "COMPLETED",
    processedRows: processed,
    errorsJson: errors.length > 0 ? errors : null,
    completedAt,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: errors.length === dataRows.length ? "bulk_import_job.failed" : "bulk_import_job.completed",
    entity: "BulkImportJob",
    entityId: job.id,
    metadata: { jobId: job.id, processedRows: processed, errorCount: errors.length },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { jobId: job.id, status: "RUNNING" };
}

export async function getBulkImportJob(dealershipId: string, jobId: string) {
  await requireTenantActiveForRead(dealershipId);
  const job = await bulkJobDb.getBulkImportJobById(dealershipId, jobId);
  if (!job) throw new ApiError("NOT_FOUND", "Import job not found");
  return job;
}

export type BulkImportJobListItem = {
  id: string;
  status: string;
  totalRows: number;
  processedRows: number | null;
  createdAt: string;
  completedAt: string | null;
};

export async function listBulkImportJobs(
  dealershipId: string,
  options: { limit: number; offset: number; status?: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" }
): Promise<{ data: BulkImportJobListItem[]; total: number }> {
  await requireTenantActiveForRead(dealershipId);
  const { data, total } = await bulkJobDb.listBulkImportJobs(dealershipId, options);
  return {
    data: data.map((j) => ({
      id: j.id,
      status: j.status,
      totalRows: j.totalRows,
      processedRows: j.processedRows,
      createdAt: j.createdAt.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
    })),
    total,
  };
}

export type BulkUpdateInput = {
  vehicleIds: string[];
  status?: VehicleStatus;
  locationId?: string | null;
};

export type BulkUpdateResult = {
  updated: number;
  errors?: Array<{ vehicleId: string; message: string }>;
};

export async function bulkUpdateVehicles(
  dealershipId: string,
  userId: string,
  input: BulkUpdateInput,
  meta?: { ip?: string; userAgent?: string }
): Promise<BulkUpdateResult> {
  await requireTenantActiveForWrite(dealershipId);
  if (input.vehicleIds.length > MAX_BULK_UPDATE_IDS) {
    throw new ApiError("VALIDATION_ERROR", `Max ${MAX_BULK_UPDATE_IDS} vehicle IDs per request`);
  }
  if (input.status === undefined && input.locationId === undefined) {
    throw new ApiError("VALIDATION_ERROR", "At least one of status or locationId is required");
  }
  const errors: Array<{ vehicleId: string; message: string }> = [];
  let updated = 0;
  for (const id of input.vehicleIds) {
    try {
      const existing = await vehicleDb.getVehicleById(dealershipId, id);
      if (!existing) {
        errors.push({ vehicleId: id, message: "Vehicle not found" });
        continue;
      }
      await vehicleService.updateVehicle(
        dealershipId,
        userId,
        id,
        {
          ...(input.status !== undefined && { status: input.status }),
          ...(input.locationId !== undefined && { locationId: input.locationId }),
        },
        meta
      );
      updated++;
    } catch (e) {
      errors.push({
        vehicleId: id,
        message: e instanceof Error ? e.message : "Update failed",
      });
    }
  }
  return { updated, errors: errors.length > 0 ? errors : undefined };
}
