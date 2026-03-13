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
import { cn } from "@/lib/utils";
import {
  modalDepthFooterSubtle,
  modalFieldTone,
} from "@/lib/ui/modal-depth";
import {
  detectDocumentKindFromFile,
  getDocumentKindLabel,
  type DocumentKindDetectionResult,
} from "../document-kind-detection";
import type {
  VehicleCostTotalsResponse,
  VehicleCostEntriesListResponse,
  VehicleCostDocumentsListResponse,
  VehicleCostEntryResponse,
  VehicleCostDocumentResponse,
  VehicleCostCategory,
} from "../types";
import { VEHICLE_COST_CATEGORY_LABELS, VEHICLE_COST_DOCUMENT_KIND_LABELS } from "../types";
import { AcquisitionSummaryCard } from "./AcquisitionSummaryCard";
import { CostTotalsCard } from "./CostTotalsCard";
import { CostLedgerCard } from "./CostLedgerCard";
import { DocumentsRailCard } from "./DocumentsRailCard";

const COST_CATEGORY_OPTIONS: SelectOption[] = (
  Object.entries(VEHICLE_COST_CATEGORY_LABELS) as [VehicleCostCategory, string][]
).map(([value, label]) => ({ value, label }));

const COST_DOCUMENT_KIND_OPTIONS: SelectOption[] = (
  Object.entries(VEHICLE_COST_DOCUMENT_KIND_LABELS) as [VehicleCostDocumentResponse["kind"], string][]
).map(([value, label]) => ({ value, label }));

export type CostsTabContentProps = {
  vehicleId?: string;
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

export type CostsTabContentHandle = {
  persistStagedToVehicle: (vehicleId: string) => Promise<void>;
  resetStaged: () => void;
};

type StagedCostDocument = VehicleCostDocumentResponse & {
  localFile: File;
  localUrl: string;
};

type FormDocumentAttachment = {
  id: string;
  file: File;
  kind: VehicleCostDocumentResponse["kind"];
  detection: DocumentKindDetectionResult | null;
  detecting: boolean;
  detectError: string | null;
};

const STAGED_VEHICLE_ID = "__staged_vehicle__";

function buildLocalCostTotals(entries: VehicleCostEntryResponse[]): VehicleCostTotalsResponse["data"] {
  let acquisitionSubtotalCents = 0;
  let transportCostCents = 0;
  let reconSubtotalCents = 0;
  let feesSubtotalCents = 0;
  let miscCostCents = 0;

  for (const entry of entries) {
    const amount = Number(entry.amountCents) || 0;
    switch (entry.category) {
      case "acquisition":
        acquisitionSubtotalCents += amount;
        break;
      case "transport":
        transportCostCents += amount;
        break;
      case "recon_parts":
      case "recon_labor":
        reconSubtotalCents += amount;
        break;
      case "auction_fee":
      case "title_fee":
      case "doc_fee":
        feesSubtotalCents += amount;
        break;
      default:
        miscCostCents += amount;
        break;
    }
  }

  const miscAndFees = feesSubtotalCents + miscCostCents;
  const totalInvestedCents =
    acquisitionSubtotalCents + transportCostCents + reconSubtotalCents + feesSubtotalCents + miscCostCents;

  return {
    vehicleId: STAGED_VEHICLE_ID,
    auctionCostCents: String(acquisitionSubtotalCents),
    transportCostCents: String(transportCostCents),
    reconCostCents: String(reconSubtotalCents),
    miscCostCents: String(miscAndFees),
    totalCostCents: String(totalInvestedCents),
    acquisitionSubtotalCents: String(acquisitionSubtotalCents),
    reconSubtotalCents: String(reconSubtotalCents),
    feesSubtotalCents: String(feesSubtotalCents),
    totalInvestedCents: String(totalInvestedCents),
  };
}

function buildStagedDocument(
  file: File,
  kind: VehicleCostDocumentResponse["kind"],
  costEntryId: string | null
): StagedCostDocument {
  const id = `staged-doc-${crypto.randomUUID()}`;
  return {
    id,
    vehicleId: STAGED_VEHICLE_ID,
    costEntryId,
    fileObjectId: id,
    kind,
    createdAt: new Date().toISOString(),
    createdByUserId: null,
    file: {
      id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    },
    localFile: file,
    localUrl: URL.createObjectURL(file),
  };
}

function getFallbackKindForFile(file: File): VehicleCostDocumentResponse["kind"] {
  const name = file.name.toLowerCase();
  if (name.includes("bill of sale") || name.includes("bill_of_sale")) return "bill_of_sale";
  if (name.includes("title") || name.includes("registration")) return "title_doc";
  if (name.includes("receipt")) return "receipt";
  if (name.includes("invoice") || name.includes("bill")) return "invoice";
  return "other";
}

export const CostsTabContent = React.forwardRef<CostsTabContentHandle, CostsTabContentProps>(function CostsTabContent({
  vehicleId,
  className,
  mode = "full-page",
  hideEmbeddedHeader = false,
  showSummaryCards = true,
  showDocuments = true,
  onDataChange,
}: CostsTabContentProps, ref) {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canReadInventory = hasPermission("inventory.read");
  const canWriteInventory = hasPermission("inventory.write");
  const canReadDocs = hasPermission("documents.read");
  const canWriteDocs = hasPermission("documents.write");
  const isStagedMode = !vehicleId;
  const canListDocuments = showDocuments && canReadInventory && canReadDocs;
  const canUploadDocument = showDocuments && canWriteInventory && canWriteDocs;

  const [cost, setCost] = React.useState<VehicleCostTotalsResponse["data"] | null>(null);
  const [entries, setEntries] = React.useState<VehicleCostEntryResponse[]>([]);
  const [documents, setDocuments] = React.useState<VehicleCostDocumentResponse[]>([]);
  const [stagedEntries, setStagedEntries] = React.useState<VehicleCostEntryResponse[]>([]);
  const [stagedDocuments, setStagedDocuments] = React.useState<StagedCostDocument[]>([]);
  const [loading, setLoading] = React.useState(!isStagedMode);
  const [error, setError] = React.useState<string | null>(null);
  const [entryModalOpen, setEntryModalOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<VehicleCostEntryResponse | null>(null);
  const [entrySubmitting, setEntrySubmitting] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploadKind, setUploadKind] = React.useState<VehicleCostDocumentResponse["kind"]>("invoice");
  const [uploadCostEntryId, setUploadCostEntryId] = React.useState("");
  const [uploadSubmitting, setUploadSubmitting] = React.useState(false);

  const [formDescription, setFormDescription] = React.useState("");
  const [formCategory, setFormCategory] = React.useState<VehicleCostCategory>("acquisition");
  const [formAmountDollars, setFormAmountDollars] = React.useState("");
  const [formVendorName, setFormVendorName] = React.useState("");
  const [formOccurredAt, setFormOccurredAt] = React.useState("");
  const [formMemo, setFormMemo] = React.useState("");
  const [formDocumentAttachments, setFormDocumentAttachments] = React.useState<FormDocumentAttachment[]>([]);
  const [activeAttachmentId, setActiveAttachmentId] = React.useState<string | null>(null);
  const stagedDocumentsRef = React.useRef<StagedCostDocument[]>([]);

  React.useEffect(() => {
    stagedDocumentsRef.current = stagedDocuments;
  }, [stagedDocuments]);

  React.useEffect(() => {
    return () => {
      for (const doc of stagedDocumentsRef.current) {
        URL.revokeObjectURL(doc.localUrl);
      }
    };
  }, []);

  const fetchCost = React.useCallback(async () => {
    if (!canReadInventory || !vehicleId) return;
    try {
      const res = await apiFetch<VehicleCostTotalsResponse>(`/api/inventory/${vehicleId}/cost`);
      setCost(res.data);
    } catch {
      setCost(null);
    }
  }, [vehicleId, canReadInventory]);

  const fetchEntries = React.useCallback(async () => {
    if (!canReadInventory || !vehicleId) return;
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
    if (!canListDocuments || !vehicleId) return;
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
    if (isStagedMode) {
      setLoading(false);
      setError(null);
      return;
    }
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
  }, [fetchCost, fetchEntries, fetchDocuments, canListDocuments, isStagedMode]);

  React.useEffect(() => {
    if (isStagedMode) {
      setLoading(false);
      setError(null);
      return;
    }
    loadAll();
  }, [isStagedMode, loadAll]);

  const entriesList = React.useMemo(
    () => (isStagedMode ? stagedEntries : Array.isArray(entries) ? entries : []),
    [entries, isStagedMode, stagedEntries]
  );
  const documentsList = React.useMemo(
    () => (isStagedMode ? stagedDocuments : Array.isArray(documents) ? documents : []),
    [documents, isStagedMode, stagedDocuments]
  );
  const displayedCost = React.useMemo(
    () => (isStagedMode ? buildLocalCostTotals(entriesList) : cost),
    [cost, entriesList, isStagedMode]
  );

  React.useEffect(() => {
    if (!onDataChange) return;
    onDataChange({
      cost: displayedCost,
      entries: entriesList,
      documents: documentsList,
    });
  }, [displayedCost, entriesList, documentsList, onDataChange]);

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
    setFormDocumentAttachments([]);
    setActiveAttachmentId(null);
    if (entry) {
      setFormDescription(entry.description ?? "");
      setFormCategory(entry.category);
      setFormAmountDollars((Number(entry.amountCents) / 100).toFixed(2));
      setFormVendorName(entry.vendorName ?? "");
      setFormOccurredAt(entry.occurredAt.slice(0, 10));
      setFormMemo(entry.memo ?? "");
    } else {
      setFormDescription("");
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
    setFormDescription("");
    setFormCategory(category);
    setFormAmountDollars("");
    setFormVendorName("");
    setFormOccurredAt(new Date().toISOString().slice(0, 10));
    setFormMemo("");
    setFormDocumentAttachments([]);
    setActiveAttachmentId(null);
    setEntryModalOpen(true);
  }, []);

  const closeEntryModal = React.useCallback(() => {
    setEntryModalOpen(false);
    setEditingEntry(null);
    setFormDocumentAttachments([]);
    setActiveAttachmentId(null);
  }, []);

  const resetUploadState = React.useCallback(() => {
    setUploadFile(null);
    setUploadKind("invoice");
    setUploadCostEntryId("");
  }, []);

  const handleFormDocumentFilesChange = React.useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const seeded = files.map((file) => ({
      id: `attachment-${crypto.randomUUID()}`,
      file,
      kind: getFallbackKindForFile(file),
      detection: null,
      detecting: true,
      detectError: null,
    }));
    setFormDocumentAttachments((current) => [...current, ...seeded]);
    setActiveAttachmentId(seeded[seeded.length - 1]?.id ?? null);

    await Promise.all(
      seeded.map(async (attachment) => {
        try {
          const detected = await detectDocumentKindFromFile(attachment.file);
          setFormDocumentAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id
                ? {
                    ...item,
                    kind: detected.kind,
                    detection: detected,
                    detecting: false,
                    detectError: null,
                  }
                : item
            )
          );
        } catch (error) {
          setFormDocumentAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id
                ? {
                    ...item,
                    detecting: false,
                    detectError: getApiErrorMessage(error) || "Could not analyze document",
                  }
                : item
            )
          );
        }
      })
    );
  }, []);

  const updateFormAttachmentKind = React.useCallback((attachmentId: string, kind: VehicleCostDocumentResponse["kind"]) => {
    setFormDocumentAttachments((current) =>
      current.map((item) => (item.id === attachmentId ? { ...item, kind } : item))
    );
  }, []);

  const removeFormAttachment = React.useCallback((attachmentId: string) => {
    setFormDocumentAttachments((current) => current.filter((item) => item.id !== attachmentId));
    setActiveAttachmentId((activeId) => (activeId === attachmentId ? null : activeId));
  }, []);

  const activeAttachment = React.useMemo(
    () => formDocumentAttachments.find((attachment) => attachment.id === activeAttachmentId) ?? formDocumentAttachments[formDocumentAttachments.length - 1] ?? null,
    [activeAttachmentId, formDocumentAttachments]
  );

  React.useEffect(() => {
    if (formDocumentAttachments.length === 0) {
      if (activeAttachmentId !== null) setActiveAttachmentId(null);
      return;
    }
    if (activeAttachmentId && formDocumentAttachments.some((attachment) => attachment.id === activeAttachmentId)) {
      return;
    }
    setActiveAttachmentId(formDocumentAttachments[formDocumentAttachments.length - 1]?.id ?? null);
  }, [activeAttachmentId, formDocumentAttachments]);

  const uploadDocumentToVehicle = React.useCallback(
    async (targetVehicleId: string, file: File, kind: VehicleCostDocumentResponse["kind"], costEntryId?: string) => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", kind);
      if (costEntryId) formData.set("costEntryId", costEntryId);
      await apiFetch(`/api/inventory/${targetVehicleId}/cost-documents`, {
        method: "POST",
        body: formData,
      });
    },
    []
  );

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWriteInventory) return;
    if (formDocumentAttachments.some((attachment) => attachment.detecting)) {
      addToast("error", "Wait for document analysis to finish.");
      return;
    }
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
      if (isStagedMode) {
        const nextEntry: VehicleCostEntryResponse = {
          id: editingEntry?.id ?? `staged-entry-${crypto.randomUUID()}`,
          vehicleId: STAGED_VEHICLE_ID,
          description: formDescription.trim() || null,
          category: formCategory,
          amountCents: String(amountCents),
          vendorName: formVendorName.trim() || null,
          vendorType: null,
          occurredAt,
          memo: formMemo.trim() || null,
          createdByUserId: editingEntry?.createdByUserId ?? "staged-user",
          createdAt: editingEntry?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setStagedEntries((current) =>
          editingEntry
            ? current.map((entry) => (entry.id === editingEntry.id ? nextEntry : entry))
            : [nextEntry, ...current].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        );
        if (formDocumentAttachments.length > 0) {
          setStagedDocuments((current) => [
            ...formDocumentAttachments.map((attachment) =>
              buildStagedDocument(attachment.file, attachment.kind, nextEntry.id)
            ),
            ...current,
          ]);
        }
        closeEntryModal();
        addToast("success", editingEntry ? "Cost entry updated." : "Cost entry added.");
      } else {
        let persistedEntryId = editingEntry?.id;
        if (editingEntry) {
          await apiFetch(`/api/inventory/${vehicleId}/cost-entries/${editingEntry.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              description: formDescription.trim() || undefined,
              category: formCategory,
              amountCents: String(amountCents),
              vendorName: formVendorName.trim() || undefined,
              occurredAt,
              memo: formMemo.trim() || undefined,
            }),
          });
          addToast("success", "Cost entry updated.");
        } else {
          const response = await apiFetch<{ data: VehicleCostEntryResponse }>(`/api/inventory/${vehicleId}/cost-entries`, {
            method: "POST",
            body: JSON.stringify({
              description: formDescription.trim() || undefined,
              category: formCategory,
              amountCents: String(amountCents),
              vendorName: formVendorName.trim() || undefined,
              occurredAt,
              memo: formMemo.trim() || undefined,
            }),
          });
          persistedEntryId = response.data.id;
          addToast("success", "Cost entry added.");
        }
        if (persistedEntryId && formDocumentAttachments.length > 0) {
          await Promise.all(
            formDocumentAttachments.map((attachment) =>
              uploadDocumentToVehicle(vehicleId, attachment.file, attachment.kind, persistedEntryId)
            )
          );
        }
        closeEntryModal();
        await Promise.all([
          fetchCost(),
          fetchEntries(),
          canListDocuments ? fetchDocuments() : Promise.resolve(),
        ]);
      }
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
      if (isStagedMode) {
        setStagedEntries((current) => current.filter((currentEntry) => currentEntry.id !== entry.id));
        setStagedDocuments((current) => {
          const removed = current.filter((doc) => doc.costEntryId === entry.id);
          for (const doc of removed) URL.revokeObjectURL(doc.localUrl);
          return current.filter((doc) => doc.costEntryId !== entry.id);
        });
      } else {
        await apiFetch(`/api/inventory/${vehicleId}/cost-entries/${entry.id}`, {
          method: "DELETE",
        });
      }
      addToast("success", "Cost entry removed.");
      if (!isStagedMode) {
        await Promise.all([
          fetchCost(),
          fetchEntries(),
          canListDocuments ? fetchDocuments() : Promise.resolve(),
        ]);
      }
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    }
  };

  const handleOpenDocument = async (fileObjectId: string) => {
    if (isStagedMode) {
      const doc = stagedDocuments.find((item) => item.fileObjectId === fileObjectId);
      if (doc?.localUrl) {
        window.open(doc.localUrl, "_blank", "noopener,noreferrer");
      } else {
        addToast("error", "Could not open document.");
      }
      return;
    }
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
      if (isStagedMode) {
        setStagedDocuments((current) => {
          const stagedDoc = current.find((item) => item.id === doc.id);
          if (stagedDoc) URL.revokeObjectURL(stagedDoc.localUrl);
          return current.filter((item) => item.id !== doc.id);
        });
      } else {
        await apiFetch(`/api/inventory/${vehicleId}/cost-documents/${doc.id}`, {
          method: "DELETE",
        });
      }
      addToast("success", "Document removed.");
      if (!isStagedMode) await fetchDocuments();
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
      if (isStagedMode) {
        setStagedDocuments((current) => [
          buildStagedDocument(uploadFile, uploadKind, uploadCostEntryId.trim() || null),
          ...current,
        ]);
      } else {
        await uploadDocumentToVehicle(vehicleId, uploadFile, uploadKind, uploadCostEntryId.trim() || undefined);
      }
      addToast("success", "Document uploaded.");
      setUploadOpen(false);
      resetUploadState();
      if (!isStagedMode) await fetchDocuments();
    } catch (err) {
      addToast("error", getApiErrorMessage(err));
    } finally {
      setUploadSubmitting(false);
    }
  };

  React.useImperativeHandle(
    ref,
    () => ({
      persistStagedToVehicle: async (targetVehicleId: string) => {
        if (!targetVehicleId || (stagedEntries.length === 0 && stagedDocuments.length === 0)) return;

        const entryIdMap = new Map<string, string>();
        for (const entry of stagedEntries) {
          const response = await apiFetch<{ data: VehicleCostEntryResponse }>(`/api/inventory/${targetVehicleId}/cost-entries`, {
            method: "POST",
            body: JSON.stringify({
              description: entry.description ?? undefined,
              category: entry.category,
              amountCents: entry.amountCents,
              vendorName: entry.vendorName ?? undefined,
              occurredAt: entry.occurredAt,
              memo: entry.memo ?? undefined,
            }),
          });
          entryIdMap.set(entry.id, response.data.id);
        }

        for (const doc of stagedDocuments) {
          await uploadDocumentToVehicle(
            targetVehicleId,
            doc.localFile,
            doc.kind,
            doc.costEntryId ? entryIdMap.get(doc.costEntryId) ?? undefined : undefined
          );
          URL.revokeObjectURL(doc.localUrl);
        }

        setStagedEntries([]);
        setStagedDocuments([]);
        resetUploadState();
      },
      resetStaged: () => {
        for (const doc of stagedDocumentsRef.current) {
          URL.revokeObjectURL(doc.localUrl);
        }
        setStagedEntries([]);
        setStagedDocuments([]);
        resetUploadState();
      },
    }),
    [resetUploadState, stagedDocuments, stagedEntries, uploadDocumentToVehicle]
  );

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
    <div className={`space-y-3 min-w-0 ${mode === "embedded" ? "space-y-2.5" : ""} ${className ?? ""}`}>
      {mode === "embedded" && !hideEmbeddedHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)]/35 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Cost ledger</p>
            <p className="text-xs text-[var(--text-soft)]">
              Manage acquisition, recon, fees, and supporting documents in the shared ledger.
            </p>
          </div>
          {vehicleId ? (
            <Link
              href={inventoryCostsPath(vehicleId)}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Open full page
            </Link>
          ) : null}
        </div>
      ) : null}

      <div
        className={`grid grid-cols-1 gap-3 min-w-0 ${
          showDocuments ? "lg:grid-cols-[1fr_300px]" : ""
        } ${mode === "embedded" ? "gap-2.5" : ""}`}
      >
      {/* Left column: summary row + ledger stacked */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Summary row: Acquisition Summary | Cost Totals */}
        {showSummaryCards ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AcquisitionSummaryCard
              acquisitionEntry={acquisitionEntry}
              cost={displayedCost}
              onEdit={acquisitionEntry && canWriteInventory ? () => openEntryModal(acquisitionEntry) : undefined}
            />
            <CostTotalsCard cost={displayedCost} />
          </div>
        ) : null}

        {/* Cost ledger — full width of left column */}
      <CostLedgerCard
        entries={entriesList}
        docsByEntryId={docsByEntryId}
        mode={mode}
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
        contentClassName="relative z-50 flex w-[calc(100vw-20px)] max-w-[1480px] max-h-[92vh] flex-col overflow-hidden rounded-[28px] border border-[color:rgba(148,163,184,0.18)] bg-[color:rgba(8,15,32,0.96)] shadow-[0_24px_80px_rgba(2,6,23,0.44)]"
      >
        <DialogContent>
          <div className="border-b border-[color:rgba(148,163,184,0.14)] px-5 pb-4 pt-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--text)]">
                  {editingEntry ? "Edit Cost" : "Add Cost"}
                </DialogTitle>
              </div>
              <button
                type="button"
                onClick={closeEntryModal}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:rgba(148,163,184,0.16)] bg-[color:rgba(15,23,42,0.62)] text-[var(--muted-text)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveEntry} className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            <div className="space-y-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--text-soft)]/88">
                    Description
                  </label>
                  <Input
                    placeholder="Repair, certification, detail, fuel, inspection..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className={cn("h-11 rounded-xl px-4 text-sm", modalFieldTone)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--text-soft)]/88">Memo</label>
                  <Input
                    placeholder="Description of this cost"
                    value={formMemo}
                    onChange={(e) => setFormMemo(e.target.value)}
                    className={cn("h-11 rounded-xl px-4 text-sm", modalFieldTone)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--text-soft)]/88">
                    Category <span className="text-[var(--danger)]">*</span>
                  </label>
                  <Select
                    options={COST_CATEGORY_OPTIONS}
                    value={formCategory}
                    onChange={(v) => setFormCategory(v as VehicleCostCategory)}
                    className={cn("h-11 rounded-xl text-sm text-[var(--text)]", modalFieldTone)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--text-soft)]/88">
                    Cost <span className="text-[var(--danger)]">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="$0.00"
                    value={formAmountDollars}
                    onChange={(e) => setFormAmountDollars(e.target.value)}
                    required
                    className={cn("h-11 rounded-xl px-4 text-sm", modalFieldTone)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--text-soft)]/88">Vendor</label>
                  <Input
                    placeholder="Vendor name"
                    value={formVendorName}
                    onChange={(e) => setFormVendorName(e.target.value)}
                    className={cn("h-11 rounded-xl px-4 text-sm", modalFieldTone)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[var(--text-soft)]/88">
                    Date Added <span className="text-[var(--danger)]">*</span>
                  </label>
                  <Input
                    type="date"
                    value={formOccurredAt ? formOccurredAt.slice(0, 10) : ""}
                    onChange={(e) => setFormOccurredAt(e.target.value || "")}
                    required
                    className={cn("h-11 rounded-xl px-4 text-sm", modalFieldTone)}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:rgba(148,163,184,0.14)] bg-[color:rgba(15,23,42,0.26)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text)]">Attachments</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]/76">
                      Add invoices, receipts, and supporting files for this cost.
                    </p>
                  </div>
                  <span className="rounded-full border border-[color:rgba(148,163,184,0.16)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-soft)]/82">
                    {formDocumentAttachments.length} file{formDocumentAttachments.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[250px_minmax(240px,0.8fr)_minmax(300px,1fr)]">
                  <div>
                    <label
                      htmlFor="cost-doc-upload"
                      className={cn(
                        "flex min-h-[208px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed px-5 py-6 text-center transition-colors hover:border-[var(--accent)]/38",
                        modalFieldTone
                      )}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:rgba(148,163,184,0.16)] bg-[color:rgba(15,23,42,0.36)] text-[var(--text-soft)]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>
                      <div>
                        <span className="text-sm text-[var(--text-soft)]/92">
                          Drag &amp; drop or <span className="font-medium text-[var(--accent)]">Browse</span>
                        </span>
                        <p className="mt-1 text-xs text-[var(--text-soft)]/72">PDF, JPG or PNG up to 25 MB</p>
                      </div>
                      <input
                        id="cost-doc-upload"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          void handleFormDocumentFilesChange(files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="rounded-[22px] border border-[color:rgba(148,163,184,0.14)] bg-[color:rgba(15,23,42,0.22)] p-3">
                    <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-soft)]/62">Files</p>
                    {formDocumentAttachments.length > 0 ? (
                      <div className="max-h-[208px] space-y-2 overflow-y-auto pr-1">
                        {formDocumentAttachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className={cn(
                              "flex w-full items-start justify-between gap-3 rounded-[18px] border px-3.5 py-3 text-left transition-colors",
                              activeAttachment?.id === attachment.id
                                ? "border-[var(--accent)]/40 bg-[color:rgba(30,64,175,0.16)]"
                                : "border-[color:rgba(148,163,184,0.14)] bg-[color:rgba(15,23,42,0.28)] hover:bg-[color:rgba(30,41,59,0.42)]"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveAttachmentId(attachment.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="truncate text-sm font-medium text-[var(--text)]">{attachment.file.name}</p>
                              <p className="mt-1 text-xs text-[var(--text-soft)]/78">
                                {attachment.detecting
                                  ? "Analyzing document..."
                                  : attachment.detection
                                    ? getDocumentKindLabel(attachment.kind)
                                    : attachment.detectError
                                      ? "Needs review"
                                      : getDocumentKindLabel(attachment.kind)}
                              </p>
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 rounded-full border border-[color:rgba(148,163,184,0.16)] px-2 py-1 text-[10px] font-medium text-[var(--text-soft)]/84">
                                {attachment.detecting
                                  ? "..."
                                  : attachment.detection
                                    ? `${Math.round(attachment.detection.confidence * 100)}%`
                                    : "Manual"}
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeFormAttachment(attachment.id);
                                }}
                                className="rounded-full border border-[color:rgba(148,163,184,0.16)] p-1.5 text-[var(--muted-text)] transition-colors hover:text-[var(--text)]"
                                aria-label={`Remove ${attachment.file.name}`}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-[208px] items-center justify-center rounded-[18px] border border-dashed border-[color:rgba(148,163,184,0.12)] text-center">
                        <p className="max-w-[180px] text-xs leading-5 text-[var(--text-soft)]/74">
                          Upload one or more files to review and classify them before saving.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[22px] border border-[color:rgba(148,163,184,0.14)] bg-[color:rgba(15,23,42,0.22)] px-4 py-4">
                    {activeAttachment ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text)]">{activeAttachment.file.name}</p>
                            <p className="mt-1 text-xs text-[var(--text-soft)]/78">
                              {activeAttachment.detecting
                                ? "Analyzing document..."
                                : activeAttachment.detection
                                  ? `Detected as ${getDocumentKindLabel(activeAttachment.kind)} via ${activeAttachment.detection.source}.`
                                  : activeAttachment.detectError
                                    ? `Detection fallback applied. ${activeAttachment.detectError}`
                                    : `Ready as ${getDocumentKindLabel(activeAttachment.kind)}.`}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[color:rgba(148,163,184,0.16)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-soft)]/88">
                            {activeAttachment.detecting
                              ? "Scanning"
                              : activeAttachment.detection
                                ? `${Math.round(activeAttachment.detection.confidence * 100)}%`
                                : "Manual"}
                          </span>
                        </div>

                        <div className="rounded-[18px] border border-[color:rgba(148,163,184,0.12)] bg-[color:rgba(15,23,42,0.24)] px-3.5 py-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-soft)]/62">Review</p>
                          <p className="mt-2 text-sm text-[var(--text-soft)]/88">
                            Confirm the detected kind before saving this cost entry.
                          </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <Select
                            id="cost-doc-kind-active"
                            label="Detected kind"
                            labelClassName="mb-1.5 block text-[13px] font-medium text-[var(--text-soft)]/88"
                            options={COST_DOCUMENT_KIND_OPTIONS}
                            value={activeAttachment.kind}
                            onChange={(v) => updateFormAttachmentKind(activeAttachment.id, v as VehicleCostDocumentResponse["kind"])}
                            className={cn("h-11 rounded-xl text-sm text-[var(--text)]", modalFieldTone)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeFormAttachment(activeAttachment.id)}
                            className="h-11"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[208px] flex-col items-center justify-center text-center">
                        <p className="text-sm font-medium text-[var(--text)]">No file selected</p>
                        <p className="mt-2 max-w-[220px] text-xs leading-5 text-[var(--text-soft)]/74">
                          Add one or more attachments to inspect detection details and adjust the kind before saving.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={`${modalDepthFooterSubtle} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--muted-text)]/90">
                  {editingEntry ? "Update the entry and keep the ledger in sync." : "Save the cost entry and attach the backup if you have it."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" variant="ghost" onClick={closeEntryModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={entrySubmitting || formDocumentAttachments.some((attachment) => attachment.detecting)}>
                  {entrySubmitting
                    ? "Saving…"
                    : formDocumentAttachments.some((attachment) => attachment.detecting)
                      ? "Analyzing…"
                      : "Save Cost"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
});
