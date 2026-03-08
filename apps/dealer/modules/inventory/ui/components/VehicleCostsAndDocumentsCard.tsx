"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { confirm } from "@/components/ui/confirm-dialog";
import { DMSCard, DMSCardContent, DMSCardHeader, DMSCardTitle } from "@/components/ui/dms-card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { typography, spacingTokens } from "@/lib/ui/tokens";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  VehicleCostTotalsResponse,
  VehicleCostEntriesListResponse,
  VehicleCostDocumentsListResponse,
  VehicleCostEntryResponse,
  VehicleCostDocumentResponse,
  VehicleCostCategory,
  VehicleCostDocumentKind,
} from "../types";
import {
  VEHICLE_COST_CATEGORY_LABELS,
  VEHICLE_COST_DOCUMENT_KIND_LABELS,
} from "../types";

const COST_CATEGORY_OPTIONS: SelectOption[] = (
  Object.entries(VEHICLE_COST_CATEGORY_LABELS) as [VehicleCostCategory, string][]
).map(([value, label]) => ({ value, label }));

const DOC_KIND_OPTIONS: SelectOption[] = (
  Object.entries(VEHICLE_COST_DOCUMENT_KIND_LABELS) as [VehicleCostDocumentKind, string][]
).map(([value, label]) => ({ value, label }));

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

function truncateMemo(memo: string | null, max = 40): string {
  if (!memo) return "—";
  return memo.length <= max ? memo : `${memo.slice(0, max)}…`;
}

export type VehicleCostsAndDocumentsCardProps = {
  vehicleId: string;
  className?: string;
};

export function VehicleCostsAndDocumentsCard({
  vehicleId,
  className,
}: VehicleCostsAndDocumentsCardProps) {
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
  const [uploadKind, setUploadKind] = React.useState<VehicleCostDocumentKind>("invoice");
  const [uploadCostEntryId, setUploadCostEntryId] = React.useState<string>("");
  const [uploadSubmitting, setUploadSubmitting] = React.useState(false);

  // Form state for add/edit entry
  const [formCategory, setFormCategory] = React.useState<VehicleCostCategory>("acquisition");
  const [formAmountDollars, setFormAmountDollars] = React.useState("");
  const [formVendorName, setFormVendorName] = React.useState("");
  const [formOccurredAt, setFormOccurredAt] = React.useState("");
  const [formMemo, setFormMemo] = React.useState("");

  const fetchCost = React.useCallback(async () => {
    if (!canReadInventory) return;
    try {
      const res = await apiFetch<VehicleCostTotalsResponse>(
        `/api/inventory/${vehicleId}/cost`
      );
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

  const openEntryModal = (entry?: VehicleCostEntryResponse) => {
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
  };

  const closeEntryModal = () => {
    setEntryModalOpen(false);
    setEditingEntry(null);
  };

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
      await Promise.all([fetchCost(), fetchEntries(), canListDocuments ? fetchDocuments() : Promise.resolve()]);
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

  return (
    <DMSCard className={cn(className)}>
      <DMSCardHeader className={spacingTokens.cardHeaderPad}>
        <DMSCardTitle className={typography.cardTitle}>
          Costs &amp; Documents
        </DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className={spacingTokens.cardContentPad}>
        {loading ? (
          <Skeleton className="h-48 w-full" aria-hidden />
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <div className="space-y-4">
            {/* 1. Acquisition summary */}
            <section>
              <h3 className={cn(typography.muted, "mb-2")}>Acquisition summary</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-[var(--muted-text)]">Source / vendor</dt>
                  <dd className="text-[var(--text)]">
                    {acquisitionEntry?.vendorName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-text)]">Purchase price</dt>
                  <dd className="text-[var(--text)]">
                    {acquisitionEntry
                      ? formatCents(acquisitionEntry.amountCents)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-text)]">Purchase date</dt>
                  <dd className="text-[var(--text)]">
                    {acquisitionEntry
                      ? formatDate(acquisitionEntry.occurredAt)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-text)]">Total invested</dt>
                  <dd className="font-medium text-[var(--text)]">
                    {cost ? formatCents(cost.totalInvestedCents) : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 2. Cost totals */}
            <section>
              <h3 className={cn(typography.muted, "mb-2")}>Cost totals</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-[var(--muted-text)]">Acquisition</dt>
                  <dd className="text-[var(--text)]">
                    {cost ? formatCents(cost.acquisitionSubtotalCents) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-text)]">Recon</dt>
                  <dd className="text-[var(--text)]">
                    {cost ? formatCents(cost.reconSubtotalCents) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-text)]">Fees</dt>
                  <dd className="text-[var(--text)]">
                    {cost ? formatCents(cost.feesSubtotalCents) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted-text)]">Total invested</dt>
                  <dd className="font-medium text-[var(--text)]">
                    {cost ? formatCents(cost.totalInvestedCents) : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 3. Cost ledger table */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className={typography.muted}>Cost ledger</h3>
                {canWriteInventory && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => openEntryModal()}
                    aria-label="Add cost entry"
                  >
                    Add cost entry
                  </Button>
                )}
              </div>
              {entriesList.length === 0 ? (
                <p className="text-sm text-[var(--text-soft)]">
                  No cost entries yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-[var(--radius-input)] border border-[var(--border)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Memo</TableHead>
                        <TableHead className="w-8" aria-label="Attachments" />
                        {(canWriteInventory) && <TableHead className="w-24">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entriesList.map((entry) => {
                        const docCount = docsByEntryId.get(entry.id)?.length ?? 0;
                        return (
                          <TableRow key={entry.id}>
                            <TableCell className="text-[var(--text)]">
                              {VEHICLE_COST_CATEGORY_LABELS[entry.category]}
                            </TableCell>
                            <TableCell className="text-[var(--text)]">
                              {formatCents(entry.amountCents)}
                            </TableCell>
                            <TableCell className="text-[var(--text-soft)]">
                              {entry.vendorName ?? "—"}
                            </TableCell>
                            <TableCell className="text-[var(--text)]">
                              {formatDate(entry.occurredAt)}
                            </TableCell>
                            <TableCell className="max-w-[120px] truncate text-[var(--text-soft)]" title={entry.memo ?? undefined}>
                              {truncateMemo(entry.memo)}
                            </TableCell>
                            <TableCell className="text-[var(--muted-text)]">
                              {docCount > 0 ? `${docCount}` : "—"}
                            </TableCell>
                            {canWriteInventory && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEntryModal(entry)}
                                    aria-label={`Edit ${VEHICLE_COST_CATEGORY_LABELS[entry.category]}`}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteEntry(entry)}
                                    aria-label={`Remove ${VEHICLE_COST_CATEGORY_LABELS[entry.category]}`}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* 4 & 5. Documents list + upload */}
            {canListDocuments && (
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className={typography.muted}>Documents</h3>
                  {canUploadDocument && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setUploadOpen(true)}
                      aria-label="Add document"
                    >
                      Add document
                    </Button>
                  )}
                </div>
                {documentsList.length === 0 ? (
                  <p className="text-sm text-[var(--text-soft)]">
                    No documents yet.
                  </p>
                ) : (
                  <ul className="space-y-2" role="list">
                    {documentsList.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-[var(--text)]">
                            {doc.file?.filename ?? doc.fileObjectId}
                          </span>
                          <span className="ml-2 text-[var(--text-soft)]">
                            {VEHICLE_COST_DOCUMENT_KIND_LABELS[doc.kind]}
                            {doc.costEntry && (
                              <> · {VEHICLE_COST_CATEGORY_LABELS[doc.costEntry.category]}</>
                            )}
                          </span>
                          <span className="ml-2 text-[var(--muted-text)]">
                            {formatDate(doc.createdAt)}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDocument(doc.fileObjectId)}
                            aria-label={`Open ${doc.file?.filename ?? "document"}`}
                          >
                            View
                          </Button>
                          {canWriteDocs && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveDocument(doc)}
                              aria-label={`Remove ${doc.file?.filename ?? "document"}`}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
      </DMSCardContent>

      {/* Add/Edit cost entry modal */}
      <Dialog
        open={entryModalOpen}
        onOpenChange={setEntryModalOpen}
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
              <Button
                type="button"
                variant="secondary"
                onClick={closeEntryModal}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={entrySubmitting}>
                {entrySubmitting ? "Saving…" : editingEntry ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload document modal */}
      <Dialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        contentClassName="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 max-w-md"
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[var(--text)]">
              Add document
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUploadDocument} className="space-y-3">
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
            {entriesList.length > 0 ? (
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
                onChange={(v) => setUploadCostEntryId(v)}
              />
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setUploadOpen(false)}
              >
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
