"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
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
import { Select, type SelectOption } from "@/components/ui/select";
import { MutationButton } from "@/components/write-guard";

const CATEGORIES = [
  "CONTRACT",
  "ID",
  "INSURANCE",
  "STIPULATION",
  "CREDIT",
  "COMPLIANCE",
  "OTHER",
] as const;
const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  ID: "ID",
  INSURANCE: "Insurance",
  STIPULATION: "Stipulation",
  CREDIT: "Credit",
  COMPLIANCE: "Compliance",
  OTHER: "Other",
};

type DealDocumentItem = {
  id: string;
  dealId: string;
  category: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: string;
  updatedAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const categoryOptions: SelectOption[] = CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c] ?? c,
}));

export function DealDocumentVaultTab({ dealId }: { dealId: string }) {
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("finance.submissions.read");
  const canWrite = hasPermission("finance.submissions.write");

  const [list, setList] = React.useState<DealDocumentItem[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = React.useState<string>("OTHER");
  const [uploadTitle, setUploadTitle] = React.useState("");
  const [uploadSubmitting, setUploadSubmitting] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletingDoc, setDeletingDoc] = React.useState<DealDocumentItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);
  const [downloadLoadingId, setDownloadLoadingId] = React.useState<string | null>(null);

  const fetchList = React.useCallback(
    async (offset = 0) => {
      if (!canRead) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{
          data: DealDocumentItem[];
          meta: { total: number; limit: number; offset: number };
        }>(
          `/api/deal-documents?dealId=${encodeURIComponent(dealId)}&limit=25&offset=${offset}`
        );
        setList(res.data ?? []);
        setMeta(res.meta ?? { total: 0, limit: 25, offset });
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [dealId, canRead]
  );

  React.useEffect(() => {
    if (!canRead) setLoading(false);
    else fetchList(0);
  }, [canRead, fetchList]);

  const handleDownload = async (doc: DealDocumentItem) => {
    if (!canRead) return;
    setDownloadLoadingId(doc.id);
    try {
      const res = await apiFetch<{ url: string; expiresAt: string }>(
        `/api/deal-documents/${doc.id}/download`
      );
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDownloadLoadingId(null);
    }
  };

  const handleUpload = async () => {
    if (!canWrite || !uploadFile) return;
    setUploadSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("dealId", dealId);
      formData.set("category", uploadCategory);
      formData.set("title", uploadTitle.trim() || uploadFile.name);
      formData.append("file", uploadFile);
      await apiFetch(`/api/deal-documents`, {
        method: "POST",
        body: formData,
      });
      addToast("success", "Document uploaded");
      setUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadCategory("OTHER");
      fetchList(meta.offset);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setUploadSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canWrite || !deletingDoc) return;
    setDeleteSubmitting(true);
    try {
      await apiFetch(`/api/deal-documents/${deletingDoc.id}`, { method: "DELETE" });
      addToast("success", "Document deleted");
      setDeleteOpen(false);
      setDeletingDoc(null);
      fetchList(meta.offset);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (!canRead) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-[var(--muted-text)]">
            You don’t have permission to view deal documents.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState message={error} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Document Vault</CardTitle>
          <p className="text-sm text-[var(--muted-text)]">
            Deal documents (contracts, IDs, insurance, stipulations, compliance).
          </p>
        </div>
        {canWrite && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setUploadOpen(true)}
          >
            Upload
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : list.length === 0 ? (
          <p className="text-sm text-[var(--muted-text)]">
            No documents in vault. Upload a file to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>{CATEGORY_LABELS[doc.category] ?? doc.category}</TableCell>
                  <TableCell>{formatSize(doc.sizeBytes)}</TableCell>
                  <TableCell className="text-[var(--muted-text)]">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <MutationButton
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadLoadingId === doc.id}
                      >
                        {downloadLoadingId === doc.id ? "..." : "Download"}
                      </MutationButton>
                      {canWrite && (
                        <MutationButton
                          size="sm"
                          variant="ghost"
                          className="text-[var(--danger)]"
                          onClick={() => {
                            setDeletingDoc(doc);
                            setDeleteOpen(true);
                          }}
                          disabled={deleteSubmitting}
                        >
                          Delete
                        </MutationButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Choose a file and category. PDF and images (JPEG, PNG, WebP) allowed. Max 25MB.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <label className="text-sm font-medium text-[var(--text)]">File</label>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              className="mt-1 block w-full text-sm text-[var(--text)]"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Input
            label="Title"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="Document title"
          />
          <Select
            label="Category"
            options={categoryOptions}
            value={uploadCategory}
            onChange={setUploadCategory}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setUploadOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!uploadFile || uploadSubmitting}
          >
            {uploadSubmitting ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogHeader>
          <DialogTitle>Delete document</DialogTitle>
          <DialogDescription>
            Remove &quot;{deletingDoc?.title}&quot; from the vault? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleteSubmitting}
          >
            {deleteSubmitting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </Dialog>
    </Card>
  );
}
