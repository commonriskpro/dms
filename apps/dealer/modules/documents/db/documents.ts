import { prisma } from "@/lib/db";
import type { DocumentType } from "@prisma/client";

const DEAL_DOCUMENTS_BUCKET = "deal-documents";

export type DocumentListFilters = {
  docType?: DocumentType;
};

export type DocumentListOptions = {
  limit: number;
  offset: number;
  filters?: DocumentListFilters;
};

export type CreateDocumentMetadataInput = {
  bucket: string;
  path: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  entityType: string;
  entityId: string;
  docType?: DocumentType | null;
  title?: string | null;
  tags?: string[];
  checksumSha256?: string | null;
};

export type UpdateDocumentMetadataInput = {
  title?: string | null;
  docType?: DocumentType | null;
  tags?: string[];
};

/**
 * List documents (FileObjects) for an entity. Scoped by dealershipId and bucket = deal-documents only.
 */
export async function listDocumentsByEntity(
  dealershipId: string,
  entityType: string,
  entityId: string,
  options: DocumentListOptions
): Promise<{ data: Array<{
  id: string;
  bucket: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  entityType: string | null;
  entityId: string | null;
  docType: DocumentType | null;
  title: string | null;
  tags: string[];
  uploadedBy: string;
  createdAt: Date;
}>; total: number }> {
  const { limit, offset, filters = {} } = options;
  const where = {
    dealershipId,
    bucket: DEAL_DOCUMENTS_BUCKET,
    entityType,
    entityId,
    deletedAt: null,
    ...(filters.docType != null && { docType: filters.docType }),
  };
  const [data, total] = await Promise.all([
    prisma.fileObject.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        bucket: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        entityType: true,
        entityId: true,
        docType: true,
        title: true,
        tags: true,
        uploadedBy: true,
        createdAt: true,
      },
    }),
    prisma.fileObject.count({ where }),
  ]);
  return { data, total };
}

/**
 * Get a single document by id. Tenant-scoped; only deal-documents bucket.
 * Returns null if not found or wrong tenant or not a deal-document.
 */
export async function getDocumentById(
  dealershipId: string,
  documentId: string
) {
  return prisma.fileObject.findFirst({
    where: {
      id: documentId,
      dealershipId,
      bucket: DEAL_DOCUMENTS_BUCKET,
      deletedAt: null,
    },
  });
}

/**
 * Create FileObject row for a deal document. Caller must have uploaded blob to storage.
 */
export async function createDocumentMetadata(
  dealershipId: string,
  data: CreateDocumentMetadataInput
) {
  return prisma.fileObject.create({
    data: {
      dealershipId,
      bucket: data.bucket,
      path: data.path,
      filename: data.filename,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      checksumSha256: data.checksumSha256 ?? null,
      uploadedBy: data.uploadedBy,
      entityType: data.entityType,
      entityId: data.entityId,
      docType: data.docType ?? null,
      title: data.title ?? null,
      tags: data.tags ?? [],
    },
  });
}

/**
 * Update document metadata (title, docType, tags). Only for deal-documents, tenant-scoped.
 */
export async function updateDocumentMetadata(
  dealershipId: string,
  documentId: string,
  data: UpdateDocumentMetadataInput
) {
  const existing = await prisma.fileObject.findFirst({
    where: {
      id: documentId,
      dealershipId,
      bucket: DEAL_DOCUMENTS_BUCKET,
      deletedAt: null,
    },
  });
  if (!existing) return null;
  const payload: { title?: string | null; docType?: DocumentType | null; tags?: string[] } = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.docType !== undefined) payload.docType = data.docType;
  if (data.tags !== undefined) payload.tags = data.tags;
  return prisma.fileObject.update({
    where: { id: documentId },
    data: payload,
  });
}

/**
 * Soft delete document. Sets deletedAt and deletedBy. Does not remove blob in v1.
 */
export async function softDeleteDocument(
  dealershipId: string,
  documentId: string,
  deletedBy: string
) {
  const doc = await prisma.fileObject.findFirst({
    where: {
      id: documentId,
      dealershipId,
      bucket: DEAL_DOCUMENTS_BUCKET,
      deletedAt: null,
    },
  });
  if (!doc) return null;
  return prisma.fileObject.update({
    where: { id: documentId },
    data: { deletedAt: new Date(), deletedBy },
  });
}
