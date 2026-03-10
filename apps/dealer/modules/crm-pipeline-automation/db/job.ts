import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { JobStatus } from "@prisma/client";

/** Lock timeout: jobs in "running" longer than this are reclaimed to "pending". */
const STUCK_JOB_MINUTES = 5;

export type CreateJobInput = {
  queueType: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  runAt: Date;
  maxRetries?: number;
};

export async function createJob(dealershipId: string, data: CreateJobInput) {
  return prisma.job.create({
    data: {
      dealershipId,
      queueType: data.queueType,
      payload: data.payload as object,
      idempotencyKey: data.idempotencyKey ?? null,
      scheduledAt: new Date(),
      runAt: data.runAt,
      status: "pending",
      maxRetries: data.maxRetries ?? 3,
    },
  });
}

export type JobListFilters = {
  status?: JobStatus;
  queueType?: string;
};

export type JobListOptions = {
  limit: number;
  offset: number;
  filters?: JobListFilters;
};

export async function listJobs(dealershipId: string, options: JobListOptions) {
  const { limit, offset, filters = {} } = options;
  const where: Record<string, unknown> = { dealershipId };
  if (filters.status) where.status = filters.status;
  if (filters.queueType) where.queueType = filters.queueType;
  const [data, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
      take: limit,
      skip: offset,
    }),
    prisma.job.count({ where }),
  ]);
  return { data, total };
}

export async function getJobById(dealershipId: string, id: string) {
  return prisma.job.findFirst({
    where: { id, dealershipId },
  });
}

/**
 * Reclaim jobs stuck in "running" past STUCK_JOB_MINUTES. Sets them back to "pending"
 * so they can be retried. Call before claimNextPendingJobs in the same worker run.
 */
export async function reclaimStuckRunningJobs(
  dealershipId: string,
  now: Date
): Promise<number> {
  const cutoff = new Date(now.getTime() - STUCK_JOB_MINUTES * 60 * 1000);
  const result = await prisma.job.updateMany({
    where: {
      dealershipId,
      status: "running",
      startedAt: { lt: cutoff },
    },
    data: { status: "pending", startedAt: null },
  });
  return result.count;
}

/**
 * Atomically claim up to `limit` pending jobs (runAt <= now) using FOR UPDATE SKIP LOCKED.
 * Only one worker can claim a given job; concurrent workers get disjoint sets.
 */
export async function claimNextPendingJobs(
  dealershipId: string,
  limit: number,
  now: Date
): Promise<{ id: string; queueType: string; payload: unknown; retryCount: number; maxRetries: number }[]> {
  type Row = { id: string; queue_type: string; payload: unknown; retry_count: number; max_retries: number };
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    WITH sub AS (
      SELECT id FROM "Job"
      WHERE "dealership_id" = ${dealershipId}::uuid AND status = 'pending' AND "run_at" <= ${now}
      ORDER BY "run_at" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "Job" j
    SET status = 'running', "started_at" = ${now}
    FROM sub
    WHERE j.id = sub.id
    RETURNING j.id, j."queue_type", j.payload, j."retry_count", j."max_retries"
  `);
  return rows.map((r) => ({
    id: r.id,
    queueType: r.queue_type,
    payload: r.payload,
    retryCount: Number(r.retry_count),
    maxRetries: Number(r.max_retries),
  }));
}

export async function completeJob(dealershipId: string, id: string, completedAt: Date) {
  return prisma.job.updateMany({
    where: { id, dealershipId },
    data: { status: "completed", completedAt },
  });
}

export async function failJob(
  dealershipId: string,
  id: string,
  errorMessage: string,
  options: { retry?: boolean; nextRunAt?: Date; deadLetter?: boolean }
) {
  if (options.deadLetter) {
    return prisma.job.updateMany({
      where: { id, dealershipId },
      data: {
        status: "dead_letter",
        completedAt: new Date(),
        errorMessage: errorMessage.slice(0, 4000),
        retryCount: { increment: 1 },
      },
    });
  }
  if (options.retry && options.nextRunAt) {
    return prisma.job.updateMany({
      where: { id, dealershipId },
      data: {
        status: "pending",
        startedAt: null,
        runAt: options.nextRunAt,
        errorMessage: errorMessage.slice(0, 4000),
        retryCount: { increment: 1 },
      },
    });
  }
  return prisma.job.updateMany({
    where: { id, dealershipId },
    data: {
      status: "failed",
      completedAt: new Date(),
      errorMessage: errorMessage.slice(0, 4000),
      retryCount: { increment: 1 },
    },
  });
}
