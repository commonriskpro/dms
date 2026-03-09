"use client";

import * as React from "react";
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
  DialogHeader,
  DialogFooter,
  DialogContent,
} from "@/components/ui/dialog";
import { costsTabSummaryGrid, costsTabWorkspaceGrid } from "@/lib/ui/recipes/layout";
import { formatCents } from "@/lib/money";
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
};

export function CostsTabContent({ vehicleId, className }: CostsTabContentProps) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canReadInventory = hasPermission("inventory.read");
  const canWriteInventory = hasPermission("inventory.write");
  const canReadDocs = hasPermission("documents.read");
  const canWriteDocs = hasPermission("documents.write");
  const canListDocuments = canReadInventory && canReadDocs;
  const canUploadDocument = canWriteInventory && canWriteDocs;

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

  const entriesList = Array.isArray(entries) ? entries : [];
  const documentsList = Array.isArray(documents) ? documents : [];

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
      setFormOccurredAt(entry.occurredAt.slice(0, 16));
      setFormMemo(entry.memo ?? "");
    } else {
      setFormCategory("acquisition");
      setFormAmountDollars("");
      setFormVendorName("");
      setFormOccurredAt(new Date().toISOString().slice(0, 16));
      setFormMemo("");
    }
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
      ? new Date(formOccurredAt).toISOString()
      : new Date().toISOString();
    setEntrySubmitting(true);
    try {
      if (editingEntry) {
        await apiFetch(`/api/inventory/${vehicleId}/cost-entries/${editingEntry.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            category: formCategory,
            amountCents: String(amountCents),
            vendorName: formVendorName.trim() || null,
            occurredAt,
            memo: formMemo.trim() || null,
          }),
        });
        addToast("success", "Cost entry updated.");
      } else {
        await apiFetch(`/api/inventory/${vehicleId}/cost-entries`, {
          method: "POST",
          body: JSON.stringify({
            category: formCategory,
            amountCents: String(amountCents),
            vendorName: formVendorName.trim() || null,
            occurredAt,
            memo: formMemo.trim() || null,
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
    <div className={`grid grid-cols-1 gap-3 min-w-0 lg:grid-cols-[1fr_300px] ${className ?? ""}`}>
      {/* Left column: summary row + ledger stacked */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Summary row: Acquisition Summary | Cost Totals */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AcquisitionSummaryCard
            acquisitionEntry={acquisitionEntry}
            cost={cost}
            onEdit={acquisitionEntry && canWriteInventory ? () => openEntryModal(acquisitionEntry) : undefined}
          />
          <CostTotalsCard cost={cost} />
        </div>

        {/* Cost ledger — full width of left column */}
        <CostLedgerCard
          entries={entriesList}
          docsByEntryId={docsByEntryId}
          canWrite={canWriteInventory}
          onAddCost={() => openEntryModal()}
          onEditEntry={openEntryModal}
          onDeleteEntry={handleDeleteEntry}
        />
      </div>

      {/* Right column: documents rail spanning full height */}
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

      {/* Add/Edit cost entry modal */}
      <Dialog
        open={entryModalOpen}
        onOpenChange={(open) => !open && closeEntryModal()}
        contentClassName="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 max-w-md"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[var(--text)]">
              {editingEntry ? "Edit cost entry" : "Add cost entry"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEntry} className="space-y-3">
            <Select
              label="Category"
              options={COST_CATEGORY_OPTIONS}
              value={formCategory}
              onChange={(v) => setFormCategory(v as VehicleCostCategory)}
            />
            <Input
              label="Amount ($)"
              type="number"
              step="0.01"
              min="0"
              value={formAmountDollars}
              onChange={(e) => setFormAmountDollars(e.target.value)}
              required
            />
            <Input
              label="Vendor name (optional)"
              value={formVendorName}
              onChange={(e) => setFormVendorName(e.target.value)}
            />
            <Input
              label="Date"
              type="datetime-local"
              value={formOccurredAt}
              onChange={(e) => setFormOccurredAt(e.target.value)}
              required
            />
            <Input
              label="Memo (optional)"
              value={formMemo}
              onChange={(e) => setFormMemo(e.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeEntryModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={entrySubmitting}>
                {entrySubmitting ? "Saving…" : editingEntry ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

