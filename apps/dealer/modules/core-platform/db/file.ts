import { prisma } from "@/lib/db";

export async function createFileObject(data: {
  dealershipId: string;
  bucket: string;
  path: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string | null;
  uploadedBy: string;
  entityType?: string | null;
  entityId?: string | null;
}) {
  return prisma.fileObject.create({
    data: {
      dealershipId: data.dealershipId,
      bucket: data.bucket,
      path: data.path,
      filename: data.filename,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      checksumSha256: data.checksumSha256 ?? null,
      uploadedBy: data.uploadedBy,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
    },
  });
}

export async function getFileObjectById(dealershipId: string, id: string) {
  return prisma.fileObject.findFirst({
    where: { id, dealershipId, deletedAt: null },
  });
}

export async function listFileObjectsByEntity(
  dealershipId: string,
  bucket: string,
  entityType: string,
  entityId: string
) {
  return prisma.fileObject.findMany({
    where: {
      dealershipId,
      bucket,
      entityType,
      entityId,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function softDeleteFileObject(
  dealershipId: string,
  fileId: string,
  deletedBy: string
) {
  const file = await prisma.fileObject.findFirst({
    where: { id: fileId, dealershipId, deletedAt: null },
  });
  if (!file) return null;
  return prisma.fileObject.update({
    where: { id: fileId },
    data: { deletedAt: new Date(), deletedBy },
  });
}
