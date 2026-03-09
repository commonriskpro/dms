import { prisma } from "@/lib/db";
import { Prisma, type BulkImportJobStatus } from "@prisma/client";

export type BulkImportJobCreateInput = {
  dealershipId: string;
  status: BulkImportJobStatus;
  totalRows: number;
  createdBy?: string | null;
};

export type BulkImportJobUpdateInput = {
  status?: BulkImportJobStatus;
  processedRows?: number;
  errorsJson?: unknown | null;
  completedAt?: Date | null;
};

export async function createBulkImportJob(data: BulkImportJobCreateInput) {
  return prisma.bulkImportJob.create({
    data: {
      dealershipId: data.dealershipId,
      status: data.status,
      totalRows: data.totalRows,
      createdBy: data.createdBy ?? null,
    },
  });
}

export async function getBulkImportJobById(dealershipId: string, id: string) {
  return prisma.bulkImportJob.findFirst({
    where: { id, dealershipId },
  });
}

export async function updateBulkImportJob(
  dealershipId: string,
  id: string,
  data: BulkImportJobUpdateInput
) {
  const errorsJson =
    data.errorsJson === undefined
      ? undefined
      : data.errorsJson === null
        ? Prisma.JsonNull
        : (data.errorsJson as Prisma.InputJsonValue);

  return prisma.bulkImportJob.updateMany({
    where: { id, dealershipId },
    data: {
      ...(data.status != null && { status: data.status }),
      ...(data.processedRows != null && { processedRows: data.processedRows }),
      ...(errorsJson !== undefined && { errorsJson }),
      ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
    },
  });
}

export async function listBulkImportJobs(
  dealershipId: string,
  options: { limit: number; offset: number; status?: BulkImportJobStatus }
) {
  const where: { dealershipId: string; status?: BulkImportJobStatus } = {
    dealershipId,
  };
  if (options.status) where.status = options.status;
  const [data, total] = await Promise.all([
    prisma.bulkImportJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.bulkImportJob.count({ where }),
  ]);
  return { data, total };
}
