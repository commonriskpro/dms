import { describe, expect, it, vi, beforeEach } from "vitest";

const platformMonitoringEventFindManyMock = vi.hoisted(() => vi.fn());
const platformMonitoringEventDeleteManyMock = vi.hoisted(() => vi.fn());
const platformAuditLogDeleteManyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    platformMonitoringEvent: {
      findMany: platformMonitoringEventFindManyMock,
      deleteMany: platformMonitoringEventDeleteManyMock,
    },
    platformAuditLog: {
      deleteMany: platformAuditLogDeleteManyMock,
    },
  },
}));

import { purgeOldMonitoringEvents } from "./monitoring-retention";

describe("monitoring retention purge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("purges monitoring events in batches and never touches audit logs", async () => {
    platformMonitoringEventFindManyMock
      .mockResolvedValueOnce([{ id: "a" }, { id: "b" }])
      .mockResolvedValueOnce([{ id: "c" }])
      .mockResolvedValueOnce([]);
    platformMonitoringEventDeleteManyMock
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await purgeOldMonitoringEvents({ olderThanDays: 30 });

    expect(result.deletedCount).toBe(3);
    expect(result.touchedTables).toEqual(["platform_monitoring_events"]);
    expect(platformMonitoringEventFindManyMock).toHaveBeenCalledTimes(3);
    expect(platformMonitoringEventDeleteManyMock).toHaveBeenCalledTimes(2);
    expect(platformAuditLogDeleteManyMock).not.toHaveBeenCalled();
  });
});
