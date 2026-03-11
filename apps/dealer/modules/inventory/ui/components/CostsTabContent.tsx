"use client";

import * as React from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogTitle,
  DialogContent,
} from "@/components/ui/dialog";
import { formatCents } from "@/lib/money";
import { inventoryCostsPath } from "@/lib/routes/detail-paths";
import type {
  VehicleCostTotalsResponse,
  VehicleCostEntriesListResponse,
  VehicleCostDocumentsListResponse,
  VehicleCostEntryResponse,
  VehicleCostDocumentResponse,
  VehicleCostCategory,
} from "../types";
import { VEHICLE_COST_CATEGORY_LABELS } from "../types";
import { AcquisitionSummaryCard } from "./AcquisitionSummaryCard";
import { CostTotalsCard } from "./CostTotalsCard";
import { CostLedgerCard } from "./CostLedgerCard";
import { DocumentsRailCard } from "./DocumentsRailCard";

const COST_CATEGORY_OPTIONS: SelectOption[] = (
  Object.entries(VEHICLE_COST_CATEGORY_LABELS) as [VehicleCostCategory, string][]
).map(([value, label]) => ({ value, label }));

export type CostsTabContentProps = {
  vehicleId: string;
  className?: string;
  mode?: "embedded" | "full-page";
  hideEmbeddedHeader?: boolean;
  showSummaryCards?: boolean;
  showDocuments?: boolean;
  onDataChange?: (snapshot: {
    cost: VehicleCostTotalsResponse["data"] | null;
    entries: VehicleCostEntryResponse[];
    documents: VehicleCostDocumentResponse[];
  }) => void;
};

export function CostsTabContent({
  vehicleId,
  className,
  mode = "full-page",
  hideEmbeddedHeader = false,
  showSummaryCards = true,
  showDocuments = true,
  onDataChange,
}: CostsTabContentProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canReadInventory = hasPermission("inventory.read");
  const canWriteInventory = hasPermission("inventory.write");
  const canReadDocs = hasPermission("documents.read");
  const canWriteDocs = hasPermission("documents.write");
  const canListDocuments = showDocuments && canReadInventory && canReadDocs;
  const canUploadDocument = showDocuments && canWriteInventory && canWriteDocs;

  const [cost, setCost] = React.useState<VehicleCostTotalsResponse["data"] | null>(null);
  const [entries, setEntries] = React.useState<VehicleCostEntryResponse[]>([]);
  const [documents, setDocuments] = React.useState<VehicleCostDocumentResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entryModalOpen, setEntryModalOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<VehicleCostEntryResponse | null>(null);
  const [entrySubmitting, setEntrySubmitting] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadKind, setUploadKind] = React.useState<VehicleCostDocumentResponse["kind"]>("invoice");
  const [uploadCostEntryId, setUploadCostEntryId] = React.useState("");
  const [uploadSubmitting, setUploadSubmitting] = React.useState(false);

  const [formCategory, setFormCategory] = React.useState<VehicleCostCategory>("acquisition");
  const [formAmountDollars, setFormAmountDollars] = React.useState("");
  const [formVendorName, setFormVendorName] = React.useState("");
  const [formOccurredAt, setFormOccurredAt] = React.useState("");
  const [formMemo, setFormMemo] = React.useState("");

  const fetchCost = React.useCallback(async () => {
    if (!canReadInventory) return;
    try {
      const res = await apiFetch<VehicleCostTotalsResponse>(`/api/inventory/${vehicleId}/cost`);
      setCost(res.data);
    } catch {
      setCost(null);
    }
  }, [vehicleId, canReadInventory]);

  const fetchEntries = React.useCallback(async () => {
    if (!canReadInventory) return;
    try {
      const res = await apiFetch<VehicleCostEntriesListResponse>(
        `/api/inventory/${vehicleId}/cost-entries`
      );
      setEntries(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setEntries([]);
    }
  }, [vehicleId, canReadInventory]);

  const fetchDocuments = React.useCallback(async () => {
    if (!canListDocuments) return;
    try {
      const res = await apiFetch<VehicleCostDocumentsListResponse>(
        `/api/inventory/${vehicleId}/cost-documents`
      );
      setDocuments(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setDocuments([]);
    }
  }, [vehicleId, canListDocuments]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchCost(),
        fetchEntries(),
        canListDocuments ? fetchDocuments() : Promise.resolve(),
      ]);
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [fetchCost, fetchEntries, fetchDocuments, canListDocuments]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const entriesList = React.useMemo(
    () => (Array.isArray(entries) ? entries : []),
    [entries]
  );
  const documentsList = React.useMemo(
    () => (Array.isArray(documents) ? documents : []),
    [documents]
  );

  React.useEffect(() => {
    if (!onDataChange) return;
    onDataChange({
      cost,
      entries: entriesList,
      documents: documentsList,
    });
  }, [cost, entriesList, documentsList, onDataChange]);

  const acquisitionEntry = React.useMemo(
    () => entriesList.find((e) => e.category === "acquisition") ?? null,
    [entriesList]
  );

  const docsByEntryId = React.useMemo(() => {
    const map = new Map<string, VehicleCostDocumentResponse[]>();
    for (const doc of documentsList) {
      const key = doc.costEntryId ?? "__vehicle__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    return map;
  }, [documentsList]);

  const openEntryModal = React.useCallback((entry?: VehicleCostEntryResponse) => {
    setEditingEntry(entry ?? null);
    if (entry) {
      setFormCategory(entry.category);
      setFormAmountDollars((Number(entry.amountCents) / 100).toFixed(2));
      setFormVendorName(entry.vendorName ?? "");
      setFormOccurredAt(entry.occurredAt.slice(0, 10));
      setFormMemo(entry.memo ?? "");
    } else {
      setFormCategory("acquisition");
      setFormAmountDollars("");
      setFormVendorName("");
      setFormOccurredAt(new Date().toISOString().slice(0, 10));
      setFormMemo("");
    }
    setEntryModalOpen(true);
  }, []);

  const openEntryModalForCategory = React.useCallback((category: VehicleCostCategory) => {
    setEditingEntry(null);
    setFormCategory(category);
    setFormAmountDollars("");
    setFormVendorName("");
    setFormOccurredAt(new Date().toISOString().slice(0, 10));
    setFormMemo("");
    setEntryModalOpen(true);
  }, []);

  const closeEntryModal = React.useCallback(() => {
    setEntryModalOpen(false);
    setEditingEntry(null);
  }, []);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWriteInventory) return;
    const amountCents = Math.round(parseFloat(formAmountDollars || "0") * 100);
    if (Number.isNaN(amountCents) || amountCents < 0) {
      addToast("error", "Enter a valid amount.");
      return;
    }
    const occurredAt = formOccurredAt
      ? new Date(`${formOccurredAt.slice(0, 10)}T12:00:00Z`).toISOString()
      : new Date().toISOString();
    setEntrySubmitting(true);
    try {
      if (editingEntry) {
        await apiFetch(`/api/inventory/${vehicleId}/cost-entries/${editingEntry.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            category: formCategory,
            amountCents: String(amountCents),
            vendorName: formVendorName.trim() || undefined,
            occurredAt,
            memo: formMemo.trim() || undefined,
          }),
        });
        addToast("success", "Cost entry updated.");
      } else {
        await apiFetch(`/api/inventory/${vehicleId}/cost-entries`, {
          method: "POST",
          body: JSON.stringify({
            category: formCategory,
            amountCents: String(amountCents),
            vendorName: formVendorName.trim() || undefined,
            occurredAt,
            memo: formMemo.trim() || undefined,
          }),
        });
        addToast("success", "Cost entry added.");
      }
      closeEntryModal();
      await Promise.all([fetchCost(), fetchEntries()]);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setEntrySubmitting(false);
    }
  };

  const handleDeleteEntry = async (entry: VehicleCostEntryResponse) => {
    if (!canWriteInventory) return;
    const ok = await confirm({
      title: "Remove cost entry",
      description: `Remove ${VEHICLE_COST_CATEGORY_LABELS[entry.category]} (${formatCents(entry.amountCents)})?`,
      confirmText: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/inventory/${vehicleId}/cost-entries/${entry.id}`, {
        method: "DELETE",
      });
      addToast("success", "Cost entry removed.");
      await Promise.all([
        fetchCost(),
        fetchEntries(),
        canListDocuments ? fetchDocuments() : Promise.resolve(),
      ]);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handleOpenDocument = async (fileObjectId: string) => {
    try {
      const res = await apiFetch<{ url: string; expiresAt: string }>(
        `/api/files/signed-url?fileId=${encodeURIComponent(fileObjectId)}`
      );
      const url = res?.url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else addToast("error", "Could not open document.");
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handleRemoveDocument = async (doc: VehicleCostDocumentResponse) => {
    if (!canWriteDocs) return;
    const ok = await confirm({
      title: "Remove document link",
      description: `Remove "${doc.file?.filename ?? "document"}" from this vehicle?`,
      confirmText: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/inventory/${vehicleId}/cost-documents/${doc.id}`, {
        method: "DELETE",
      });
      addToast("success", "Document removed.");
      await fetchDocuments();
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUploadDocument || !uploadFile) {
      addToast("error", "Select a file.");
      return;
    }
    setUploadSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("kind", uploadKind);
      if (uploadCostEntryId.trim()) formData.set("costEntryId", uploadCostEntryId.trim());
      await apiFetch(`/api/inventory/${vehicleId}/cost-documents`, {
        method: "POST",
        body: formData,
      });
      addToast("success", "Document uploaded.");
      setUploadOpen(false);
      setUploadFile(null);
      setUploadKind("invoice");
      setUploadCostEntryId("");
      await fetchDocuments();
    } catch (err) {
      addToast("error", getApiErrorMessage(err));
    } finally {
      setUploadSubmitting(false);
    }
  };

  if (!canReadInventory) return null;

  if (loading) {
    return (
      <div className={`grid grid-cols-1 gap-3 min-w-0 lg:grid-cols-[1fr_300px] ${className ?? ""}`}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="min-h-[300px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 min-w-0 ${className ?? ""}`}>
      {mode === "embedded" && !hideEmbeddedHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)]/35 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Cost ledger</p>
            <p className="text-xs text-[var(--text-soft)]">
              Manage acquisition, recon, fees, and supporting documents in the shared ledger.
            </p>
          </div>
          <Link
            href={inventoryCostsPath(vehicleId)}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Open full page
          </Link>
        </div>
      ) : null}

      <div
        className={`grid grid-cols-1 gap-3 min-w-0 ${
          showDocuments ? "lg:grid-cols-[1fr_300px]" : ""
        }`}
      >
      {/* Left column: summary row + ledger stacked */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Summary row: Acquisition Summary | Cost Totals */}
        {showSummaryCards ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AcquisitionSummaryCard
              acquisitionEntry={acquisitionEntry}
              cost={cost}
              onEdit={acquisitionEntry && canWriteInventory ? () => openEntryModal(acquisitionEntry) : undefined}
            />
            <CostTotalsCard cost={cost} />
          </div>
        ) : null}

        {/* Cost ledger — full width of left column */}
        <CostLedgerCard
          entries={entriesList}
          docsByEntryId={docsByEntryId}
          canWrite={canWriteInventory}
          onAddCost={() => openEntryModal()}
          onQuickAddCategory={openEntryModalForCategory}
          onUploadDocument={canUploadDocument ? () => setUploadOpen(true) : undefined}
          onEditEntry={openEntryModal}
          onDeleteEntry={handleDeleteEntry}
        />
      </div>

      {/* Right column: documents rail spanning full height */}
      {showDocuments ? (
        <DocumentsRailCard
          documents={documentsList}
          entries={entriesList}
          canListDocuments={canListDocuments}
          canUploadDocument={canUploadDocument}
          canWriteDocs={canWriteDocs}
          onViewDocument={handleOpenDocument}
          onRemoveDocument={handleRemoveDocument}
          uploadOpen={uploadOpen}
          setUploadOpen={setUploadOpen}
          uploadFile={uploadFile}
          setUploadFile={setUploadFile}
          uploadKind={uploadKind}
          setUploadKind={setUploadKind}
          uploadCostEntryId={uploadCostEntryId}
          setUploadCostEntryId={setUploadCostEntryId}
          uploadSubmitting={uploadSubmitting}
          onUploadSubmit={handleUploadDocument}
        />
      ) : null}
      </div>

      {/* Add/Edit cost entry modal */}
      <Dialog
        open={entryModalOpen}
        onOpenChange={(open) => !open && closeEntryModal()}
        contentClassName="relative z-50 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-lg"
      >
        <DialogContent>
          {/* Header with close button */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <DialogTitle className="text-lg font-semibold text-[var(--text)]">
              {editingEntry ? "Edit Cost" : "Add Cost"}
            </DialogTitle>
            <button
              type="button"
              onClick={closeEntryModal}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-input)] text-[var(--muted-text)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSaveEntry} className="px-6 pb-6 space-y-5">
            {/* Row 1: Category + Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Category <span className="text-[var(--danger)]">*</span>
                </label>
                <Select
                  options={COST_CATEGORY_OPTIONS}
                  value={formCategory}
                  onChange={(v) => setFormCategory(v as VehicleCostCategory)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Amount <span className="text-[var(--danger)]">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="$0.00"
                  value={formAmountDollars}
                  onChange={(e) => setFormAmountDollars(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Row 2: Vendor + Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Vendor</label>
                <Input
                  placeholder="Vendor name"
                  value={formVendorName}
                  onChange={(e) => setFormVendorName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                  Date <span className="text-[var(--danger)]">*</span>
                </label>
                <Input
                  type="date"
                  value={formOccurredAt ? formOccurredAt.slice(0, 10) : ""}
                  onChange={(e) => setFormOccurredAt(e.target.value || "")}
                  required
                />
              </div>
            </div>

            {/* Row 3: Memo */}
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Memo</label>
              <Input
                placeholder="Description of this cost"
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
              />
            </div>

            {/* Row 4: Attach Document + Document Kind */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Attach Document</label>
                <label
                  htmlFor="cost-doc-upload"
                  className="flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)]/30 px-4 py-6 cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted-text)]" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-xs text-[var(--muted-text)]">
                    Drag &amp; drop or <span className="font-medium text-[var(--accent)]">Browse</span>
                  </span>
                  <span className="text-[10px] text-[var(--muted-text)]">PDF, JPG or PNG (Max 25 MB)</span>
                  <input
                    id="cost-doc-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUploadFile(f);
                        const name = f.name.toLowerCase();
                        if (f.type.startsWith("image/")) {
                          setUploadKind("other");
                        } else if (name.includes("receipt")) {
                          setUploadKind("receipt");
                        } else if (name.includes("invoice") || name.includes("bill")) {
                          setUploadKind("invoice");
                        } else {
                          setUploadKind("invoice");
                        }
                      }
                    }}
                  />
                </label>
                {uploadFile && (
                  <p className="mt-1.5 text-xs text-[var(--text-soft)] truncate">{uploadFile.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Document Kind</label>
                <Select
                  options={[
                    { value: "invoice", label: "Invoice" },
                    { value: "receipt", label: "Receipt" },
                    { value: "photo", label: "Photo" },
                    { value: "other", label: "Other" },
                  ]}
                  value={uploadKind}
                  onChange={(v) => setUploadKind(v as VehicleCostDocumentResponse["kind"])}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <Button type="button" variant="secondary" onClick={closeEntryModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={entrySubmitting}>
                {entrySubmitting ? "Saving…" : "Save Cost"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
