/** @jest-environment node */

describe("getQueueSingleton", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.REDIS_URL = "redis://localhost:6379";
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  it("reuses the same Queue instance for repeated calls to the same queue name", async () => {
    const queueCtor = jest.fn((name: string) => ({ name }));

    jest.doMock("bullmq", () => ({
      Queue: queueCtor,
    }));

    jest.doMock("@/lib/infrastructure/jobs/redis", () => ({
      redisConnection: { url: process.env.REDIS_URL },
    }));

    const { getQueueSingleton } = await import("./queueSingleton");
    const first = await getQueueSingleton("analytics");
    const second = await getQueueSingleton("analytics");

    expect(first).toBe(second);
    expect(queueCtor).toHaveBeenCalledTimes(1);
    expect(queueCtor).toHaveBeenCalledWith(
      "analytics",
      expect.objectContaining({ connection: expect.any(Object) })
    );
  });

  it("creates separate Queue instances for different queue names", async () => {
    const queueCtor = jest.fn((name: string) => ({ name }));

    jest.doMock("bullmq", () => ({
      Queue: queueCtor,
    }));

    jest.doMock("@/lib/infrastructure/jobs/redis", () => ({
      redisConnection: { url: process.env.REDIS_URL },
    }));

    const { getQueueSingleton } = await import("./queueSingleton");
    const analyticsQueue = await getQueueSingleton("analytics");
    const alertsQueue = await getQueueSingleton("alerts");

    expect(analyticsQueue).not.toBe(alertsQueue);
    expect(queueCtor).toHaveBeenCalledTimes(2);
  });
});
