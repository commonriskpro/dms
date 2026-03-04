/**
 * Job worker skips processing when tenant lifecycle is not ACTIVE (SUSPENDED/CLOSED).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getDealershipLifecycleStatusMock = vi.hoisted(() => vi.fn());
const auditLogMock = vi.hoisted(() => vi.fn());
const jobDbMock = vi.hoisted(() => ({
  reclaimStuckRunningJobs: vi.fn(),
  claimNextPendingJobs: vi.fn(),
}));
const dealerJobRunDbMock = vi.hoisted(() => ({ createDealerJobRun: vi.fn() }));
vi.mock("@/lib/tenant-status", () => ({
  getDealershipLifecycleStatus: getDealershipLifecycleStatusMock,
}));
vi.mock("@/lib/audit", () => ({ auditLog: auditLogMock }));
vi.mock("../db/job", () => jobDbMock);
vi.mock("../db/dealer-job-run", () => dealerJobRunDbMock);

import { runJobWorker } from "../service/job-worker";

describe("Job worker tenant guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("when lifecycleStatus is SUSPENDED, returns zeros and does not claim jobs", async () => {
    getDealershipLifecycleStatusMock.mockResolvedValue("SUSPENDED");
    const result = await runJobWorker("deal-1");
    expect(result).toEqual({ processed: 0, failed: 0, deadLetter: 0 });
    expect(jobDbMock.claimNextPendingJobs).not.toHaveBeenCalled();
    expect(dealerJobRunDbMock.createDealerJobRun).toHaveBeenCalledWith(
      "deal-1",
      expect.objectContaining({
        dealershipId: "deal-1",
        processed: 0,
        failed: 0,
        deadLetter: 0,
        skippedReason: "tenant_not_active",
      })
    );
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "job.skipped",
        metadata: expect.objectContaining({ reason: "tenant_not_active", lifecycleStatus: "SUSPENDED" }),
      })
    );
  });

  it("when lifecycleStatus is CLOSED, returns zeros and does not claim jobs", async () => {
    getDealershipLifecycleStatusMock.mockResolvedValue("CLOSED");
    const result = await runJobWorker("deal-1");
    expect(result).toEqual({ processed: 0, failed: 0, deadLetter: 0 });
    expect(jobDbMock.claimNextPendingJobs).not.toHaveBeenCalled();
  });

  it("when lifecycleStatus is null (no dealership), returns zeros", async () => {
    getDealershipLifecycleStatusMock.mockResolvedValue(null);
    const result = await runJobWorker("deal-1");
    expect(result).toEqual({ processed: 0, failed: 0, deadLetter: 0 });
    expect(jobDbMock.claimNextPendingJobs).not.toHaveBeenCalled();
  });
});
