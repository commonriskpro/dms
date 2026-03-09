jest.mock("../db/bulk-import-job", () => ({
  createBulkImportJob: jest.fn(),
  getBulkImportJobById: jest.fn(),
  updateBulkImportJob: jest.fn(),
}));

jest.mock("../db/vehicle", () => ({
  findActiveVehicleByStockNumber: jest.fn(),
  findActiveVehicleByVin: jest.fn(),
}));

jest.mock("./vehicle", () => ({
  createVehicle: jest.fn(),
}));

jest.mock("@/lib/audit", () => ({
  auditLog: jest.fn(),
}));

jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
  requireTenantActiveForWrite: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/infrastructure/jobs/enqueueBulkImport", () => ({
  enqueueBulkImport: jest.fn(),
}));

import * as bulkJobDb from "../db/bulk-import-job";
import * as vehicleDb from "../db/vehicle";
import * as vehicleService from "./vehicle";
import { auditLog } from "@/lib/audit";
import { enqueueBulkImport } from "@/lib/infrastructure/jobs/enqueueBulkImport";
import { applyBulkImport, runBulkImportJob } from "./bulk";

describe("bulk worker integration helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("applyBulkImport creates a pending job and enqueues normalized rows", async () => {
    (bulkJobDb.createBulkImportJob as jest.Mock).mockResolvedValue({ id: "job-1" });
    (enqueueBulkImport as jest.Mock).mockResolvedValue({ enqueued: true });

    const result = await applyBulkImport(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "stockNumber,vin,status,salePriceCents\nS-100,1HGCM82633A004352,available,1299900"
    );

    expect(bulkJobDb.createBulkImportJob).toHaveBeenCalledWith({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      status: "PENDING",
      totalRows: 1,
      createdBy: "22222222-2222-2222-2222-222222222222",
    });
    expect(enqueueBulkImport).toHaveBeenCalledWith(
      {
        dealershipId: "11111111-1111-1111-1111-111111111111",
        importId: "job-1",
        requestedByUserId: "22222222-2222-2222-2222-222222222222",
        rowCount: 1,
        rows: [
          {
            rowNumber: 2,
            stockNumber: "S-100",
            vin: "1HGCM82633A004352",
            status: "AVAILABLE",
            salePriceCents: 1299900,
          },
        ],
      },
      expect.any(Function)
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "bulk_import_job.created",
        entityId: "job-1",
      })
    );
    expect(result).toEqual({ jobId: "job-1", status: "PENDING" });
  });

  it("runBulkImportJob processes rows and completes the job", async () => {
    (bulkJobDb.getBulkImportJobById as jest.Mock).mockResolvedValue({
      id: "job-1",
      dealershipId: "11111111-1111-1111-1111-111111111111",
      status: "PENDING",
      processedRows: null,
      errorsJson: null,
      createdAt: new Date("2026-03-01T00:00:00Z"),
    });
    (vehicleService.createVehicle as jest.Mock).mockResolvedValue({ id: "veh-1" });

    const onProgress = jest.fn();
    const result = await runBulkImportJob(
      "11111111-1111-1111-1111-111111111111",
      "job-1",
      "22222222-2222-2222-2222-222222222222",
      [{ rowNumber: 2, stockNumber: "S-100", vin: "1HGCM82633A004352", status: "AVAILABLE" }],
      { onProgress }
    );

    expect(vehicleService.createVehicle).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      expect.objectContaining({
        stockNumber: "S-100",
        vin: "1HGCM82633A004352",
        status: "AVAILABLE",
      }),
      undefined
    );
    expect(onProgress).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual({
      jobId: "job-1",
      status: "COMPLETED",
      processedRows: 1,
      errorCount: 0,
    });
    expect(bulkJobDb.updateBulkImportJob).toHaveBeenLastCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "job-1",
      expect.objectContaining({
        status: "COMPLETED",
        processedRows: 1,
        errorsJson: null,
      })
    );
  });

  it("treats replayed conflict rows as already applied", async () => {
    (bulkJobDb.getBulkImportJobById as jest.Mock).mockResolvedValue({
      id: "job-2",
      dealershipId: "11111111-1111-1111-1111-111111111111",
      status: "RUNNING",
      processedRows: 0,
      errorsJson: null,
      createdAt: new Date("2026-03-01T00:00:00Z"),
    });
    (vehicleService.createVehicle as jest.Mock).mockRejectedValue(
      new Error("Stock number already in use")
    );
    (vehicleDb.findActiveVehicleByStockNumber as jest.Mock).mockResolvedValue({
      id: "veh-1",
      createdAt: new Date("2026-03-01T00:01:00Z"),
    });
    (vehicleDb.findActiveVehicleByVin as jest.Mock).mockResolvedValue(null);

    const result = await runBulkImportJob(
      "11111111-1111-1111-1111-111111111111",
      "job-2",
      "22222222-2222-2222-2222-222222222222",
      [{ rowNumber: 2, stockNumber: "S-100", vin: "1HGCM82633A004352" }]
    );

    expect(result).toEqual({
      jobId: "job-2",
      status: "COMPLETED",
      processedRows: 1,
      errorCount: 0,
    });
  });
});
