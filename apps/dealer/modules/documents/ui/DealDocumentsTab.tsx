"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { MutationButton, useWriteDisabled, WriteGuard } from "@/components/write-guard";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DocumentItem,
  DocumentsListResponse,
  SignedUrlResponse,
  DocType,
} from "./types";
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  getDocTypeLabel,
} from "./types";

const DEFAULT_LIMIT = 25;
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const docTypeFilterOptions: SelectOption[] = [
  { value: "", label: "All types" },
  ...DOC_TYPES.map((v) => ({ value: v, label: DOC_TYPE_LABELS[v] ?? v })),
];

const docTypeSelectOptions: SelectOption[] = DOC_TYPES.map((v) => ({
  value: v,
  label: DOC_TYPE_LABELS[v] ?? v,
}));

export function DealDocumentsTab({ dealId }: { dealId: string }) {
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canRead = hasPermission("documents.read");
  const canWrite = hasPermission("documents.write");

  const [list, setList] = React.useState<DocumentItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: DEFAULT_LIMIT, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [docTypeFilter, setDocTypeFilter] = React.useState("");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editingDoc, setEditingDoc] = React.useState<DocumentItem | null>(null);
  const [deletingDoc, setDeletingDoc] = React.useState<DocumentItem | null>(null);

  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = React.useState<DocType>("OTHER");
  const [uploadTitle, setUploadTitle] = React.useState("");
  const [uploadSubmitting, setUploadSubmitting] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const [editTitle, setEditTitle] = React.useState("");
  const [editDocType, setEditDocType] = React.useState<DocType>("OTHER");
  const [editTags, setEditTags] = React.useState("");
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [downloadLoadingId, setDownloadLoadingId] = React.useState<string | null>(null);

  const fetchDocuments = React.useCallback(
    async (offset = 0) => {
      if (!canRead) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          entityType: "DEAL",
          entityId: dealId,
          limit: String(DEFAULT_LIMIT),
          offset: String(offset),
        });
        if (docTypeFilter) params.set("docType", docTypeFilter);
        const res = await apiFetch<DocumentsListResponse>(
          `/api/documents?${params.toString()}`
        );
        setList(res.data ?? []);
        setMeta(res.meta ?? { total: 0, limit: DEFAULT_LIMIT, offset: 0 });
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [dealId, canRead, docTypeFilter]
  );

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    fetchDocuments(0);
  }, [canRead, fetchDocuments]);

  const onPageChange = React.useCallback(
    (newOffset: number) => {
      if (!canRead) return;
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        entityType: "DEAL",
        entityId: dealId,
        limit: String(DEFAULT_LIMIT),
        offset: String(newOffset),
      });
      if (docTypeFilter) params.set("docType", docTypeFilter);
      apiFetch<DocumentsListResponse>(`/api/documents?${params.toString()}`)
        .then((res) => {
          setList(res.data ?? []);
          setMeta(res.meta ?? { total: 0, limit: DEFAULT_LIMIT, offset: newOffset });
        })
        .catch((e) => setError(getApiErrorMessage(e)))
        .finally(() => setLoading(false));
    },
    [dealId, canRead, docTypeFilter]
  );

  const handleDownload = React.useCallback(
    async (doc: DocumentItem) => {
      if (!canRead) return;
      setDownloadLoadingId(doc.id);
      try {
        const res = await apiFetch<SignedUrlResponse>(
          `/api/documents/signed-url?documentId=${encodeURIComponent(doc.id)}`
        );
        if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
      } finally {
        setDownloadLoadingId(null);
      }
    },
    [canRead, addToast]
  );

  const openEdit = (doc: DocumentItem) => {
    setEditingDoc(doc);
    setEditTitle(doc.title ?? "");
    setEditDocType((doc.docType as DocType) ?? "OTHER");
    setEditTags((doc.tags ?? []).join(", "));
    setEditError(null);
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editingDoc || !canWrite) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const payload: { title?: string | null; docType?: DocType; tags?: string[] } = {};
      if (editTitle.trim() !== (editingDoc.title ?? "")) payload.title = editTitle.trim() || null;
      if (editDocType !== (editingDoc.docType ?? "OTHER")) payload.docType = editDocType;
      const tagList = editTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (JSON.stringify(tagList) !== JSON.stringify(editingDoc.tags ?? [])) payload.tags = tagList;
      if (Object.keys(payload).length === 0) {
        setEditOpen(false);
        setEditingDoc(null);
        return;
      }
      await apiFetch<DocumentItem>(`/api/documents/${editingDoc.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      addToast("success", "Document updated");
      setEditOpen(false);
      setEditingDoc(null);
      fetchDocuments(meta.offset);
    } catch (e) {
      setEditError(getApiErrorMessage(e));
      addToast("error", getApiErrorMessage(e));
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingDoc || !canWrite) return;
    setDeleteSubmitting(true);
    try {
      await apiFetch(`/api/documents/${deletingDoc.id}`, {
        method: "DELETE",
        expectNoContent: true,
      });
      addToast("success", "Document deleted");
      setDeleteOpen(false);
      setDeletingDoc(null);
      fetchDocuments(meta.offset);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !uploadFile) return;
    if (!ALLOWED_MIME.has(uploadFile.type)) {
      setUploadError("Allowed types: PDF, JPEG, PNG, WebP.");
      return;
    }
    const maxBytes =
      uploadFile.type === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (uploadFile.size > maxBytes) {
      setUploadError(
        uploadFile.type === "application/pdf"
          ? "PDF must be 25 MB or less."
          : "Images must be 10 MB or less."
      );
      return;
    }
    setUploadSubmitting(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("entityType", "DEAL");
      form.append("entityId", dealId);
      form.append("docType", uploadDocType);
      if (uploadTitle.trim()) form.append("title", uploadTitle.trim());
      await apiFetch<DocumentItem>("/api/documents/upload", {
        method: "POST",
        body: form,
      });
      addToast("success", "Document uploaded");
      setUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadDocType("OTHER");
      fetchDocuments(0);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      setUploadError(msg);
      addToast("error", msg);
    } finally {
      setUploadSubmitting(false);
    }
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">
            You don&apos;t have access to documents.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <CardTitle className="text-base">Documents</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Type"
            options={docTypeFilterOptions}
            value={docTypeFilter}
            onChange={(v) => {
              setDocTypeFilter(v);
            }}
            className="w-40"
            aria-label="Filter by document type"
          />
          {canWrite && (
            <WriteGuard>
              <Button
                onClick={() => {
                  setUploadOpen(true);
                  setUploadError(null);
                  setUploadFile(null);
                  setUploadTitle("");
                  setUploadDocType("OTHER");
                }}
                disabled={writeDisabled}
                aria-label="Upload document"
              >
                Upload Document
              </Button>
            </WriteGuard>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && list.length === 0 ? (
          <Skeleton className="h-48 w-full" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchDocuments(meta.offset)} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No documents"
            description="Upload a PDF or image to attach to this deal."
            actionLabel={canWrite && !writeDisabled ? "Upload Document" : undefined}
            onAction={canWrite && !writeDisabled ? () => setUploadOpen(true) : undefined}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doc Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>{getDocTypeLabel(doc.docType)}</TableCell>
                    <TableCell>{doc.title || "—"}</TableCell>
                    <TableCell>{doc.filename}</TableCell>
                    <TableCell className="text-right">
                      {formatSize(doc.sizeBytes)}
                    </TableCell>
                    <TableCell>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadLoadingId === doc.id}
                          aria-label={`View or download ${doc.filename}`}
                        >
                          {downloadLoadingId === doc.id ? "…" : "View/Download"}
                        </Button>
                        {canWrite ? (
                          <WriteGuard>
                            <span className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={writeDisabled}
                                onClick={() => openEdit(doc)}
                                aria-label={`Edit ${doc.filename}`}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={writeDisabled}
                                onClick={() => {
                                  setDeletingDoc(doc);
                                  setDeleteOpen(true);
                                }}
                                aria-label={`Delete ${doc.filename}`}
                              >
                                Delete
                              </Button>
                            </span>
                          </WriteGuard>
                        ) : (
                          <span className="text-xs text-[var(--text-soft)]">
                            Not allowed to edit or delete
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {meta.total > meta.limit && (
              <Pagination
                meta={meta}
                onPageChange={onPageChange}
              />
            )}
          </>
        )}
      </CardContent>

      {/* Upload modal */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            PDF (max 25 MB) or image — JPEG, PNG, WebP (max 10 MB).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">
              File
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setUploadFile(f ?? null);
                setUploadError(null);
              }}
              className="block w-full text-sm text-[var(--text)] file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[var(--muted)] file:text-sm"
              aria-label="Choose file"
            />
          </div>
          <Select
            label="Doc Type"
            options={docTypeSelectOptions}
            value={uploadDocType}
            onChange={(v) => setUploadDocType(v as DocType)}
          />
          <Input
            label="Title (optional)"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="e.g. Buyer's Order signed"
          />
          {uploadError && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {uploadError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUploadOpen(false)}
            >
              Cancel
            </Button>
            <MutationButton type="submit" disabled={uploadSubmitting || !uploadFile || writeDisabled}>
              {uploadSubmitting ? "Uploading…" : "Upload"}
            </MutationButton>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Edit metadata modal */}
      <Dialog open={editOpen} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
          <DialogDescription>
            Update title, type, or tags. Changes save immediately.
          </DialogDescription>
        </DialogHeader>
        {editingDoc && (
          <div className="space-y-4">
            <Input
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Optional display title"
            />
            <Select
              label="Doc Type"
              options={docTypeSelectOptions}
              value={editDocType}
              onChange={(v) => setEditDocType(v as DocType)}
            />
            <Input
              label="Tags (comma-separated)"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="e.g. signed, copy"
            />
            {editError && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {editError}
              </p>
            )}
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditOpen(false);
                  setEditingDoc(null);
                }}
              >
                Cancel
              </Button>
              <MutationButton onClick={submitEdit} disabled={editSubmitting || writeDisabled}>
                {editSubmitting ? "Saving…" : "Save"}
              </MutationButton>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeletingDoc(null)}>
        <DialogHeader>
          <DialogTitle>Delete document?</DialogTitle>
          <DialogDescription>
            This will remove the document from this deal. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <MutationButton
            variant="secondary"
            onClick={confirmDelete}
            disabled={deleteSubmitting || writeDisabled}
          >
            {deleteSubmitting ? "Deleting…" : "Delete"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
