import type { Queue } from "bullmq";

const queueSingletons = new Map<string, Promise<Queue>>();

export async function getQueueSingleton<T>(queueName: string): Promise<Queue<T>> {
  let queuePromise = queueSingletons.get(queueName);
  if (!queuePromise) {
    queuePromise = (async () => {
      const { Queue } = await import("bullmq");
      const { redisConnection } = await import("@/lib/infrastructure/jobs/redis");
      return new Queue(queueName, { connection: redisConnection });
    })().catch((error) => {
      queueSingletons.delete(queueName);
      throw error;
    });
    queueSingletons.set(queueName, queuePromise);
  }
  return queuePromise as Promise<Queue<T>>;
}
