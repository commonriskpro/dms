jest.mock("@/lib/db", () => ({
  prisma: {
    platformMonitoringEvent: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    platformAuditLog: {
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { purgeOldMonitoringEvents } from "./monitoring-retention";

describe("monitoring retention purge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("purges monitoring events in batches and never touches audit logs", async () => {
    (prisma.platformMonitoringEvent.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: "a" }, { id: "b" }])
      .mockResolvedValueOnce([{ id: "c" }])
      .mockResolvedValueOnce([]);
    (prisma.platformMonitoringEvent.deleteMany as jest.Mock)
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await purgeOldMonitoringEvents({ olderThanDays: 30 });

    expect(result.deletedCount).toBe(3);
    expect(result.touchedTables).toEqual(["platform_monitoring_events"]);
    expect(prisma.platformMonitoringEvent.findMany).toHaveBeenCalledTimes(3);
    expect(prisma.platformMonitoringEvent.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.platformAuditLog.deleteMany).not.toHaveBeenCalled();
  });
});
