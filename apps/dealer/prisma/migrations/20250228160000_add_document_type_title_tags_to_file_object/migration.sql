-- Documents module: extend FileObject with docType, title, tags (Option A).
-- Preserves existing FileObject rows (inventory-photos): nullable doc_type/title, tags default [].
-- See docs/design/documents-spec.md

-- CreateEnum DocumentType
CREATE TYPE "DocumentType" AS ENUM ('BUYERS_ORDER', 'CONTRACT', 'TITLE', 'ODOMETER', 'STIP_INCOME', 'STIP_RESIDENCE', 'STIP_INSURANCE', 'PAYOFF', 'OTHER');

-- AlterTable FileObject: add doc_type, title, tags
ALTER TABLE "FileObject" ADD COLUMN "doc_type" "DocumentType";
ALTER TABLE "FileObject" ADD COLUMN "title" VARCHAR(255);
ALTER TABLE "FileObject" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

-- CreateIndex for filtering list by document category
CREATE INDEX "FileObject_dealership_id_doc_type_idx" ON "FileObject"("dealership_id", "doc_type");
