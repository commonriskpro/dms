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
import type { BulkImportJobStatus, VehicleStatus } from "@prisma/client";
import { enqueueBulkImport, type BulkImportJobData } from "@/lib/infrastructure/jobs/enqueueBulkImport";

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
export type BulkImportRow = BulkImportJobData["rows"][number];
export type BulkImportExecutionResult = {
  jobId: string;
  status: "COMPLETED" | "FAILED";
  processedRows: number;
  errorCount: number;
};

type TerminalBulkImportJobStatus = Extract<BulkImportJobStatus, "COMPLETED" | "FAILED">;

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

function normalizeBulkImportRows(fileContent: string): BulkImportRow[] {
  const rows = parseCsvToRows(fileContent);
  const dataRows = rows.length <= 1 ? [] : rows.slice(1);
  const header = rows[0] ? normalizeHeader(rows[0]) : [];
  const stockNumberIdx = header.indexOf("stocknumber");
  const vinIdx = header.indexOf("vin");
  const statusIdx = header.indexOf("status");
  const salePriceIdx = header.indexOf("salepricecents");

  return dataRows.map((cells, index) => {
    const salePriceRaw = salePriceIdx >= 0 ? Number(cells[salePriceIdx]) : Number.NaN;
    return {
      rowNumber: index + 2,
      stockNumber: stockNumberIdx >= 0 ? cells[stockNumberIdx]?.trim() ?? "" : "",
      vin: vinIdx >= 0 ? cells[vinIdx]?.trim() || undefined : undefined,
      status:
        statusIdx >= 0 && cells[statusIdx]
          ? cells[statusIdx].trim().toUpperCase()
          : undefined,
      salePriceCents:
        salePriceIdx >= 0 && !Number.isNaN(salePriceRaw) && salePriceRaw >= 0
          ? Math.round(salePriceRaw)
          : undefined,
    };
  });
}

function parsePersistedErrors(
  errorsJson: unknown
): Array<{ row?: number; message: string }> {
  if (!Array.isArray(errorsJson)) return [];
  return errorsJson.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as { row?: unknown; message?: unknown };
    if (typeof candidate.message !== "string") return [];
    return [
      {
        row: typeof candidate.row === "number" ? candidate.row : undefined,
        message: candidate.message,
      },
    ];
  });
}

function isJobTerminal(status: BulkImportJobStatus): status is TerminalBulkImportJobStatus {
  return status === "COMPLETED" || status === "FAILED";
}

async function handleBulkImportConflict(
  dealershipId: string,
  jobCreatedAt: Date,
  row: BulkImportRow
): Promise<boolean> {
  const [existingStock, existingVin] = await Promise.all([
    row.stockNumber
      ? vehicleDb.findActiveVehicleByStockNumber(dealershipId, row.stockNumber)
      : Promise.resolve(null),
    row.vin ? vehicleDb.findActiveVehicleByVin(dealershipId, row.vin) : Promise.resolve(null),
  ]);

  const existing = existingVin ?? existingStock;
  if (!existing) return false;

  return existing.createdAt.getTime() >= jobCreatedAt.getTime();
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
  const normalizedRows = normalizeBulkImportRows(fileContent);

  const job = await bulkJobDb.createBulkImportJob({
    dealershipId,
    status: "PENDING",
    totalRows: dataRows.length,
    createdBy: userId,
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

  const enqueueResult = await enqueueBulkImport(
    {
      dealershipId,
      importId: job.id,
      requestedByUserId: userId,
      rowCount: normalizedRows.length,
      rows: normalizedRows,
    },
    async (payload) => {
      await runBulkImportJob(
        payload.dealershipId,
        payload.importId,
        payload.requestedByUserId,
        payload.rows
      );
    }
  );

  return { jobId: job.id, status: enqueueResult.enqueued ? "PENDING" : "RUNNING" };
}

export async function runBulkImportJob(
  dealershipId: string,
  jobId: string,
  userId: string,
  rows: BulkImportRow[],
  options: {
    meta?: { ip?: string; userAgent?: string };
    onProgress?: (processedRows: number, totalRows: number) => Promise<void> | void;
  } = {}
): Promise<BulkImportExecutionResult> {
  await requireTenantActiveForWrite(dealershipId);

  const job = await bulkJobDb.getBulkImportJobById(dealershipId, jobId);
  if (!job) throw new ApiError("NOT_FOUND", "Import job not found");

  if (isJobTerminal(job.status)) {
    return {
      jobId,
      status: job.status,
      processedRows: job.processedRows ?? 0,
      errorCount: parsePersistedErrors(job.errorsJson).length,
    };
  }

  const errors = parsePersistedErrors(job.errorsJson);
  let processed = job.processedRows ?? 0;

  await bulkJobDb.updateBulkImportJob(dealershipId, jobId, {
    status: "RUNNING",
    processedRows: processed,
    errorsJson: errors.length > 0 ? errors : null,
  });

  for (let index = processed; index < rows.length; index++) {
    const row = rows[index];
    if (!row.stockNumber) {
      errors.push({ row: row.rowNumber, message: "stockNumber is required" });
      processed++;
    } else {
      const status =
        row.status && VEHICLE_STATUSES.has(row.status as VehicleStatus)
          ? (row.status as VehicleStatus)
          : undefined;
      const salePriceCents =
        typeof row.salePriceCents === "number" ? BigInt(Math.round(row.salePriceCents)) : undefined;

      try {
        await vehicleService.createVehicle(
          dealershipId,
          userId,
          {
            stockNumber: row.stockNumber,
            vin: row.vin,
            status,
            salePriceCents,
          },
          options.meta
        );
      } catch (error) {
        const isReplayConflict =
          error instanceof Error &&
          (error.message === "Stock number already in use" ||
            error.message === "VIN already in use for this dealership");

        if (!isReplayConflict || !(await handleBulkImportConflict(dealershipId, job.createdAt, row))) {
          errors.push({
            row: row.rowNumber,
            message: error instanceof Error ? error.message : "Create failed",
          });
        }
      }

      processed++;
    }

    await bulkJobDb.updateBulkImportJob(dealershipId, jobId, {
      processedRows: processed,
      errorsJson: errors.length > 0 ? errors : null,
    });
    await options.onProgress?.(processed, rows.length);
  }

  const status: BulkImportExecutionResult["status"] =
    errors.length > 0 && errors.length === rows.length ? "FAILED" : "COMPLETED";
  const completedAt = new Date();
  await bulkJobDb.updateBulkImportJob(dealershipId, jobId, {
    status,
    processedRows: processed,
    errorsJson: errors.length > 0 ? errors : null,
    completedAt,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: status === "FAILED" ? "bulk_import_job.failed" : "bulk_import_job.completed",
    entity: "BulkImportJob",
    entityId: jobId,
    metadata: { jobId, processedRows: processed, errorCount: errors.length },
    ip: options.meta?.ip,
    userAgent: options.meta?.userAgent,
  });

  return {
    jobId,
    status,
    processedRows: processed,
    errorCount: errors.length,
  };
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
