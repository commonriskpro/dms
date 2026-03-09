import { prisma } from "@/lib/db";
import type { DealDocumentCategory } from "@prisma/client";

export type CreateDealDocumentInput = {
  dealershipId: string;
  dealId: string;
  creditApplicationId?: string | null;
  lenderApplicationId?: string | null;
  category: DealDocumentCategory;
  title: string;
  fileObjectId: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
};

export type ListDealDocumentsOptions = {
  dealId: string;
  category?: DealDocumentCategory;
  limit: number;
  offset: number;
};

export async function createDealDocument(data: CreateDealDocumentInput) {
  return prisma.dealDocument.create({
    data: {
      dealershipId: data.dealershipId,
      dealId: data.dealId,
      creditApplicationId: data.creditApplicationId ?? null,
      lenderApplicationId: data.lenderApplicationId ?? null,
      category: data.category,
      title: data.title.slice(0, 255),
      fileObjectId: data.fileObjectId,
      mimeType: data.mimeType.slice(0, 128),
      sizeBytes: data.sizeBytes,
      uploadedByUserId: data.uploadedByUserId,
    },
  });
}

export async function getDealDocumentById(dealershipId: string, id: string) {
  return prisma.dealDocument.findFirst({
    where: { id, dealershipId },
    include: { fileObject: true },
  });
}

export async function listDealDocuments(
  dealershipId: string,
  options: ListDealDocumentsOptions
) {
  const where = {
    dealershipId,
    dealId: options.dealId,
    ...(options.category != null && { category: options.category }),
  };
  const [data, total] = await Promise.all([
    prisma.dealDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
      include: { fileObject: { select: { id: true, path: true, bucket: true } } },
    }),
    prisma.dealDocument.count({ where }),
  ]);
  return { data, total };
}

export async function deleteDealDocument(dealershipId: string, id: string) {
  const doc = await prisma.dealDocument.findFirst({
    where: { id, dealershipId },
    select: { id: true, fileObjectId: true },
  });
  if (!doc) return null;
  await prisma.dealDocument.delete({ where: { id } });
  return doc;
}
