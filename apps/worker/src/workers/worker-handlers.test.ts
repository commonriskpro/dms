process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

jest.mock("../dealerInternalApi", () => ({
  postDealerInternalJob: jest.fn(),
}));

import type { Job } from "bullmq";
import { postDealerInternalJob } from "../dealerInternalApi";
import { processBulkImportJob } from "./bulkImport.worker";
import { processAnalyticsJob } from "./analytics.worker";
import { processAlertJob } from "./alerts.worker";
import { processVinDecodeJob } from "./vinDecode.worker";

const postDealerInternalJobMock = postDealerInternalJob as jest.MockedFunction<typeof postDealerInternalJob>;

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
  });

  it("bulk import worker posts to the dealer internal bulk-import endpoint", async () => {
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
    expect(result).toEqual({
      jobId: "import-1",
      status: "COMPLETED",
      processedRows: 2,
      errorCount: 0,
    });
  });

  it("analytics worker posts to the dealer internal analytics endpoint", async () => {
    postDealerInternalJobMock.mockResolvedValue({
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

    expect(postDealerInternalJobMock).toHaveBeenCalledWith("/api/internal/jobs/analytics", job.data);
  });

  it("alerts worker posts to the dealer internal alerts endpoint", async () => {
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
  });

  it("vin decode worker posts to the dealer internal vin-decode endpoint", async () => {
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
  });
});
