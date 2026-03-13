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
import { X } from "@/lib/ui/icons";
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

      </DMSCardContent>

      {/* Upload dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        contentClassName="relative z-50 w-full max-w-[760px] max-h-[90vh] overflow-y-auto rounded-[28px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(8,24,54,0.985),rgba(6,18,40,0.985))] p-0 shadow-[0_28px_90px_rgba(2,8,23,0.52)]"
      >
        <DialogContent>
          <DialogHeader className="border-b border-[var(--border)] px-6 pb-5 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--muted-text)]">
                  Document intake
                </p>
                <DialogTitle className="text-[1.75rem] font-semibold tracking-[-0.04em] text-[var(--text)]">
                  Add document
                </DialogTitle>
                <p className="max-w-xl text-sm text-[var(--muted-text)]">
                  Attach supporting paperwork to the vehicle and optionally link it to a specific cost entry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--muted-text)] transition-colors hover:text-[var(--text)]"
                aria-label="Close document upload modal"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
          </DialogHeader>
          <form onSubmit={onUploadSubmit} className="flex min-h-0 flex-col">
            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <label
                    htmlFor="documents-rail-upload"
                    className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-6 py-8 text-center transition-colors hover:border-[var(--accent)]/40 hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)]">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-text)]" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <p className="mt-5 text-lg font-medium text-[var(--text)]">
                      Drop a file here
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted-text)]">
                      or click to browse PDF, JPG, PNG, or WEBP
                    </p>
                    <p className="mt-3 text-xs text-[var(--muted-text)]">
                      Use this for invoices, receipts, titles, and other backup documents.
                    </p>
                  </label>
                  <Input
                    id="documents-rail-upload"
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    required
                    className="sr-only"
                  />

                  {uploadFile ? (
                    <div className="rounded-[20px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">
                        Selected file
                      </p>
                      <p className="mt-2 truncate text-sm font-medium text-[var(--text)]">
                        {uploadFile.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted-text)]">
                        {formatFileSize(uploadFile.size)}{uploadFile.type ? ` · ${uploadFile.type}` : ""}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.025)] px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">
                      Classification
                    </p>
                    <div className="mt-4">
                      <Select
                        label="Kind"
                        options={DOC_KIND_OPTIONS}
                        value={uploadKind}
                        onChange={(v) => setUploadKind(v as VehicleCostDocumentKind)}
                      />
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted-text)]">
                      This drives filtering and icon treatment in the vehicle documents rail.
                    </p>
                  </div>

                  {entriesList.length > 0 ? (
                    <div className="rounded-[24px] border border-[var(--border)] bg-[rgba(255,255,255,0.025)] px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted-text)]">
                        Link target
                      </p>
                      <div className="mt-4">
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
                      </div>
                      <p className="mt-3 text-xs text-[var(--muted-text)]">
                        Leave this unlinked if the document belongs to the vehicle record broadly.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 mt-auto flex items-center justify-between gap-4 border-t border-[var(--border)] bg-[rgba(5,16,35,0.94)] px-6 py-4 backdrop-blur">
              <div className="min-w-0">
                <p className="text-sm text-[var(--text)]">The document is only attached when you upload it.</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                    {uploadFile ? "File ready" : "No file selected"}
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                    {VEHICLE_COST_DOCUMENT_KIND_LABELS[uploadKind]}
                  </span>
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted-text)]">
                    {uploadCostEntryId ? "Linked to cost entry" : "Vehicle only"}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => setUploadOpen(false)}>
                Cancel
                </Button>
                <Button type="submit" disabled={uploadSubmitting || !uploadFile}>
                  {uploadSubmitting ? "Uploading…" : "Upload document"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DMSCard>
  );
}
