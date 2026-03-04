/**
 * Job worker skips processing when tenant lifecycle is not ACTIVE (SUSPENDED/CLOSED).
 */
jest.mock("@/lib/tenant-status", () => ({
  getDealershipLifecycleStatus: jest.fn(),
}));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn() }));
jest.mock("../db/job", () => ({
  reclaimStuckRunningJobs: jest.fn(),
  claimNextPendingJobs: jest.fn(),
}));
jest.mock("../db/dealer-job-run", () => ({ createDealerJobRun: jest.fn() }));

import { getDealershipLifecycleStatus } from "@/lib/tenant-status";
import { auditLog } from "@/lib/audit";
import * as jobDb from "../db/job";
import * as dealerJobRunDb from "../db/dealer-job-run";
import { runJobWorker } from "../service/job-worker";

describe("Job worker tenant guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("when lifecycleStatus is SUSPENDED, returns zeros and does not claim jobs", async () => {
    (getDealershipLifecycleStatus as jest.Mock).mockResolvedValue("SUSPENDED");
    const result = await runJobWorker("deal-1");
    expect(result).toEqual({ processed: 0, failed: 0, deadLetter: 0 });
    expect(jobDb.claimNextPendingJobs).not.toHaveBeenCalled();
    expect(dealerJobRunDb.createDealerJobRun).toHaveBeenCalledWith(
      "deal-1",
      expect.objectContaining({
        dealershipId: "deal-1",
        processed: 0,
        failed: 0,
        deadLetter: 0,
        skippedReason: "tenant_not_active",
      })
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "job.skipped",
        metadata: expect.objectContaining({ reason: "tenant_not_active", lifecycleStatus: "SUSPENDED" }),
      })
    );
  });

  it("when lifecycleStatus is CLOSED, returns zeros and does not claim jobs", async () => {
    (getDealershipLifecycleStatus as jest.Mock).mockResolvedValue("CLOSED");
    const result = await runJobWorker("deal-1");
    expect(result).toEqual({ processed: 0, failed: 0, deadLetter: 0 });
    expect(jobDb.claimNextPendingJobs).not.toHaveBeenCalled();
  });

  it("when lifecycleStatus is null (no dealership), returns zeros", async () => {
    (getDealershipLifecycleStatus as jest.Mock).mockResolvedValue(null);
    const result = await runJobWorker("deal-1");
    expect(result).toEqual({ processed: 0, failed: 0, deadLetter: 0 });
    expect(jobDb.claimNextPendingJobs).not.toHaveBeenCalled();
  });
});
