process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

jest.mock("../dealerInternalApi", () => ({
  postDealerInternalJob: jest.fn(),
}));
jest.mock("./analytics.direct", () => ({
  executeAnalyticsDirect: jest.fn(),
}));
jest.mock("./alerts.direct", () => ({
  executeAlertsDirect: jest.fn(),
}));
jest.mock("./vinDecode.direct", () => ({
  executeVinDecodeDirect: jest.fn(),
}));
jest.mock("./bulkImport.direct", () => ({
  executeBulkImportDirect: jest.fn(),
}));

import type { Job } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { executeAnalyticsDirect } from "./analytics.direct";
import { executeAlertsDirect } from "./alerts.direct";
import { executeVinDecodeDirect } from "./vinDecode.direct";
import { executeBulkImportDirect } from "./bulkImport.direct";
import { processBulkImportJob } from "./bulkImport.worker";
import { processAnalyticsJob } from "./analytics.worker";
import { processAlertJob } from "./alerts.worker";
import { processVinDecodeJob } from "./vinDecode.worker";
import { processCrmExecutionJob } from "./crmExecution.worker";

const postDealerInternalJobMock = postDealerInternalJob as jest.MockedFunction<typeof postDealerInternalJob>;
const executeAnalyticsDirectMock = executeAnalyticsDirect as jest.MockedFunction<typeof executeAnalyticsDirect>;
const executeAlertsDirectMock = executeAlertsDirect as jest.MockedFunction<typeof executeAlertsDirect>;
const executeVinDecodeDirectMock = executeVinDecodeDirect as jest.MockedFunction<typeof executeVinDecodeDirect>;
const executeBulkImportDirectMock = executeBulkImportDirect as jest.MockedFunction<typeof executeBulkImportDirect>;

function makeJob<T>(data: T): Job<T> {
  return {
    id: "job-1",
    data,
    attemptsMade: 0,
    updateProgress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<T>;
}

describe("worker handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WORKER_ANALYTICS_EXECUTION_MODE;
    delete process.env.WORKER_ALERTS_EXECUTION_MODE;
    delete process.env.WORKER_VINDECODE_EXECUTION_MODE;
    delete process.env.WORKER_BULKIMPORT_EXECUTION_MODE;
  });

  it("bulk import worker uses direct execution by default", async () => {
    executeBulkImportDirectMock.mockResolvedValue({
      jobId: "import-1",
      status: "COMPLETED",
      processedRows: 2,
      errorCount: 0,
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      importId: "import-1",
      requestedByUserId: "22222222-2222-2222-2222-222222222222",
      rowCount: 2,
      rows: [
        { rowNumber: 2, stockNumber: "S-1", vin: "1HGCM82633A004352" },
        { rowNumber: 3, stockNumber: "S-2" },
      ],
    });

    const result = await processBulkImportJob(job);

    expect(job.updateProgress).toHaveBeenNthCalledWith(1, 0);
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, 100);
    expect(executeBulkImportDirectMock).toHaveBeenCalledWith(job.data);
    expect(postDealerInternalJobMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      jobId: "import-1",
      status: "COMPLETED",
      processedRows: 2,
      errorCount: 0,
    });
  });

  it("bulk import worker can fall back to bridge mode for rollback", async () => {
    process.env.WORKER_BULKIMPORT_EXECUTION_MODE = "bridge";
    postDealerInternalJobMock.mockResolvedValue({
      jobId: "import-1",
      status: "COMPLETED",
      processedRows: 2,
      errorCount: 0,
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      importId: "import-1",
      requestedByUserId: "22222222-2222-2222-2222-222222222222",
      rowCount: 2,
      rows: [
        { rowNumber: 2, stockNumber: "S-1", vin: "1HGCM82633A004352" },
        { rowNumber: 3, stockNumber: "S-2" },
      ],
    });

    const result = await processBulkImportJob(job);

    expect(job.updateProgress).toHaveBeenNthCalledWith(1, 0);
    expect(job.updateProgress).toHaveBeenNthCalledWith(2, 100);
    expect(postDealerInternalJobMock).toHaveBeenCalledWith("/api/internal/jobs/bulk-import", job.data);
    expect(executeBulkImportDirectMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      jobId: "import-1",
      status: "COMPLETED",
      processedRows: 2,
      errorCount: 0,
    });
  });

  it("analytics worker uses direct execution by default", async () => {
    executeAnalyticsDirectMock.mockResolvedValue({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      type: "sales_metrics",
      invalidatedPrefixes: ["dealer:1:cache:dashboard:"],
      signalRuns: { deals: { created: 1 } },
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      type: "sales_metrics",
      context: { dealId: "deal-1" },
    });

    await processAnalyticsJob(job);

    expect(executeAnalyticsDirectMock).toHaveBeenCalledWith(job.data);
    expect(postDealerInternalJobMock).not.toHaveBeenCalled();
  });

  it("analytics worker can fall back to bridge mode for rollback", async () => {
    process.env.WORKER_ANALYTICS_EXECUTION_MODE = "bridge";
    postDealerInternalJobMock.mockResolvedValue({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      type: "sales_metrics",
      invalidatedPrefixes: [],
      signalRuns: {},
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      type: "sales_metrics",
      context: { dealId: "deal-1" },
    });

    await processAnalyticsJob(job);

    expect(postDealerInternalJobMock).toHaveBeenCalledWith("/api/internal/jobs/analytics", job.data);
    expect(executeAnalyticsDirectMock).not.toHaveBeenCalled();
  });

  it("alerts worker uses direct execution by default", async () => {
    executeAlertsDirectMock.mockResolvedValue({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      type: "alert_check",
      invalidatedPrefixes: [],
      signalRuns: {},
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      ruleId: "inventory.stale",
      triggeredAt: "2026-03-09T10:00:00.000Z",
    });

    await processAlertJob(job);

    expect(executeAlertsDirectMock).toHaveBeenCalledWith(job.data);
    expect(postDealerInternalJobMock).not.toHaveBeenCalled();
  });

  it("alerts worker can fall back to bridge mode for rollback", async () => {
    process.env.WORKER_ALERTS_EXECUTION_MODE = "bridge";
    postDealerInternalJobMock.mockResolvedValue({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      type: "alert_check",
      invalidatedPrefixes: [],
      signalRuns: {},
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      ruleId: "inventory.stale",
      triggeredAt: "2026-03-09T10:00:00.000Z",
    });

    await processAlertJob(job);

    expect(postDealerInternalJobMock).toHaveBeenCalledWith("/api/internal/jobs/alerts", job.data);
    expect(executeAlertsDirectMock).not.toHaveBeenCalled();
  });

  it("vin decode worker uses direct execution by default", async () => {
    executeVinDecodeDirectMock.mockResolvedValue({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      vehicleId: "33333333-3333-3333-3333-333333333333",
      vin: "1HGCM82633A004352",
      cacheWarmed: true,
      attachedDecode: true,
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      vehicleId: "33333333-3333-3333-3333-333333333333",
      vin: "1HGCM82633A004352",
    });

    await processVinDecodeJob(job);

    expect(executeVinDecodeDirectMock).toHaveBeenCalledWith(job.data);
    expect(postDealerInternalJobMock).not.toHaveBeenCalled();
  });

  it("vin decode worker can fall back to bridge mode for rollback", async () => {
    process.env.WORKER_VINDECODE_EXECUTION_MODE = "bridge";
    postDealerInternalJobMock.mockResolvedValue({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      vehicleId: "33333333-3333-3333-3333-333333333333",
      vin: "1HGCM82633A004352",
      cacheWarmed: true,
      attachedDecode: true,
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      vehicleId: "33333333-3333-3333-3333-333333333333",
      vin: "1HGCM82633A004352",
    });

    await processVinDecodeJob(job);

    expect(postDealerInternalJobMock).toHaveBeenCalledWith("/api/internal/jobs/vin-decode", job.data);
    expect(executeVinDecodeDirectMock).not.toHaveBeenCalled();
  });

  it("crm execution worker posts to the dealer internal crm endpoint", async () => {
    postDealerInternalJobMock.mockResolvedValue({
      processed: 3,
      failed: 1,
      deadLetter: 0,
    });

    const job = makeJob({
      dealershipId: "11111111-1111-1111-1111-111111111111",
      source: "manual" as const,
      triggeredByUserId: "22222222-2222-2222-2222-222222222222",
    });

    const result = await processCrmExecutionJob(job);

    expect(postDealerInternalJobMock).toHaveBeenCalledWith("/api/internal/jobs/crm", job.data);
    expect(result).toEqual({
      processed: 3,
      failed: 1,
      deadLetter: 0,
    });
  });
});
