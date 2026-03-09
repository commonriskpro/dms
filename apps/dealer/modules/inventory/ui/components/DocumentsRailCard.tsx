"use client";

import * as React from "react";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogFooter,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { typography } from "@/lib/ui/tokens";
import type {
  VehicleCostDocumentResponse,
  VehicleCostEntryResponse,
  VehicleCostDocumentKind,
} from "../types";
import { VEHICLE_COST_DOCUMENT_KIND_LABELS, VEHICLE_COST_CATEGORY_LABELS } from "../types";
import { formatCents } from "@/lib/money";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(mimeType: string | undefined, filename: string | undefined): boolean {
  return mimeType === "application/pdf" || (filename?.toLowerCase().endsWith(".pdf") ?? false);
}

function isImage(mimeType: string | undefined): boolean {
  return mimeType?.startsWith("image/") ?? false;
}

type DocTab = "all" | "invoice" | "receipt" | "photo";

const DOC_TABS: { id: DocTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "invoice", label: "Invoices" },
  { id: "receipt", label: "Receipts" },
  { id: "photo", label: "Photos" },
];

const DOC_KIND_OPTIONS: SelectOption[] = (
  Object.entries(VEHICLE_COST_DOCUMENT_KIND_LABELS) as [VehicleCostDocumentKind, string][]
).map(([value, label]) => ({ value, label }));

function FileTypeIcon({ mimeType, filename }: { mimeType?: string; filename?: string }) {
  if (isPdf(mimeType, filename)) {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-[var(--radius-input)] bg-[var(--danger-muted)] flex items-center justify-center">
        <span className="text-[var(--danger-muted-fg)] text-[9px] font-bold leading-none tracking-tight">PDF</span>
      </div>
    );
  }
  if (isImage(mimeType)) {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-[var(--radius-input)] bg-[var(--info-muted)] flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--info-muted-fg)]" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-[var(--radius-input)] bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-soft)]" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>
  );
}

export type DocumentsRailCardProps = {
  documents: VehicleCostDocumentResponse[];
  entries: VehicleCostEntryResponse[];
  canListDocuments: boolean;
  canUploadDocument: boolean;
  canWriteDocs: boolean;
  onViewDocument: (fileObjectId: string) => void;
  onRemoveDocument: (doc: VehicleCostDocumentResponse) => void;
  uploadOpen: boolean;
  setUploadOpen: (open: boolean) => void;
  uploadFile: File | null;
  setUploadFile: (f: File | null) => void;
  uploadKind: VehicleCostDocumentKind;
  setUploadKind: (k: VehicleCostDocumentKind) => void;
  uploadCostEntryId: string;
  setUploadCostEntryId: (id: string) => void;
  uploadSubmitting: boolean;
  onUploadSubmit: (e: React.FormEvent) => void;
};

export function DocumentsRailCard({
  documents,
  entries,
  canListDocuments,
  canUploadDocument,
  canWriteDocs,
  onViewDocument,
  onRemoveDocument,
  uploadOpen,
  setUploadOpen,
  uploadFile,
  setUploadFile,
  uploadKind,
  setUploadKind,
  uploadCostEntryId,
  setUploadCostEntryId,
  uploadSubmitting,
  onUploadSubmit,
}: DocumentsRailCardProps) {
  const [activeTab, setActiveTab] = React.useState<DocTab>("all");

  const entriesList = Array.isArray(entries) ? entries : [];

  const filteredDocs = React.useMemo(() => {
    if (activeTab === "all") return documents;
    if (activeTab === "photo") return documents.filter((d) => isImage(d.file?.mimeType));
    return documents.filter((d) => d.kind === activeTab);
  }, [documents, activeTab]);

  if (!canListDocuments) return null;

  return (
    <DMSCard className="p-0 overflow-hidden flex flex-col">
      {/* Header */}
      <DMSCardHeader className="flex flex-row items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-[var(--border)]">
        <DMSCardTitle className={typography.cardTitle}>Documents</DMSCardTitle>
        {canUploadDocument && (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            aria-label="Upload document"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
        )}
      </DMSCardHeader>

      {/* Tab filter bar */}
      <div className="flex items-center gap-0 px-3 pt-2 pb-0 border-b border-[var(--border)]">
        {DOC_TABS.map((tab) => {
          const count =
            tab.id === "all"
              ? documents.length
              : tab.id === "photo"
                ? documents.filter((d) => isImage(d.file?.mimeType)).length
                : documents.filter((d) => d.kind === tab.id).length;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)]",
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1 text-[10px] text-[var(--muted-text)]">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <DMSCardContent className="p-0 flex flex-col flex-1">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-text)]" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-xs text-[var(--text-soft)]">
              {documents.length === 0 ? "No documents yet." : "No documents in this category."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]" role="list">
            {filteredDocs.map((doc) => (
              <li key={doc.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-[var(--surface-2)]/50 transition-colors">
                <FileTypeIcon mimeType={doc.file?.mimeType} filename={doc.file?.filename} />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onViewDocument(doc.fileObjectId)}
                    className="block text-left w-full truncate text-sm font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors leading-snug"
                    aria-label={`Open ${doc.file?.filename ?? "document"}`}
                  >
                    {doc.file?.filename ?? doc.fileObjectId}
                  </button>
                  <span className="text-xs text-[var(--muted-text)]">
                    {formatDate(doc.createdAt)}
                    {doc.file?.sizeBytes ? ` · ${formatFileSize(doc.file.sizeBytes)}` : ""}
                  </span>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canWriteDocs && (
                    <button
                      type="button"
                      onClick={() => onRemoveDocument(doc)}
                      aria-label={`Remove ${doc.file?.filename ?? "document"}`}
                      className="rounded p-1 text-[var(--muted-text)] hover:text-[var(--danger)] hover:bg-[var(--danger-muted)] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Add Note footer */}
        <div className="mt-auto px-4 py-3 border-t border-[var(--border)]">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-xs text-[var(--text-soft)] hover:text-[var(--text)] transition-colors"
            aria-label="Add note"
          >
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--border)] text-[var(--muted-text)]">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            Add Note
          </button>
        </div>
      </DMSCardContent>

      {/* Upload dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        contentClassName="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 max-w-md"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[var(--text)]">Add document</DialogTitle>
          </DialogHeader>
          <form onSubmit={onUploadSubmit} className="space-y-3">
            <Input
              label="File"
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              required
            />
            <Select
              label="Kind"
              options={DOC_KIND_OPTIONS}
              value={uploadKind}
              onChange={(v) => setUploadKind(v as VehicleCostDocumentKind)}
            />
            {entriesList.length > 0 && (
              <Select
                label="Link to cost entry (optional)"
                options={[
                  { value: "", label: "Vehicle only" },
                  ...entriesList.map((e) => ({
                    value: e.id,
                    label: `${VEHICLE_COST_CATEGORY_LABELS[e.category]} – ${formatCents(e.amountCents)}`,
                  })),
                ]}
                value={uploadCostEntryId}
                onChange={setUploadCostEntryId}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={uploadSubmitting || !uploadFile}>
                {uploadSubmitting ? "Uploading…" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DMSCard>
  );
}
