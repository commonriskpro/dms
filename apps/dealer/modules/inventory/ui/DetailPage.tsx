"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { formatCents } from "@/lib/money";
import type {
  VehicleDetailResponse,
  VehiclePhotoResponse,
} from "./types";
import {
  VEHICLE_STATUS_OPTIONS,
  getSalePriceCents,
  getAuctionCostCents,
  getReconCostCents,
  getMiscCostCents,
} from "./types";

function transportCostCents(v: VehicleDetailResponse): string {
  return v.transportCostCents != null && v.transportCostCents !== "" ? v.transportCostCents : "";
}

function daysInStock(createdAt: string): number {
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)
  );
}

export function InventoryDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");
  const canReadDocs = hasPermission("documents.read");
  const canWriteDocs = hasPermission("documents.write");

  const [vehicle, setVehicle] = React.useState<VehicleDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoUploadError, setPhotoUploadError] = React.useState<string | null>(null);

  const fetchVehicle = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: VehicleDetailResponse }>(
        `/api/inventory/${id}`
      );
      setVehicle(res.data);
      setError(null);
      setNotFound(false);
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 404) {
        setNotFound(true);
        setVehicle(null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load vehicle");
      }
    } finally {
      setLoading(false);
    }
  }, [id, canRead]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchVehicle();
  }, [canRead, id, fetchVehicle]);

  const fetchPhotoUrls = React.useCallback(async (photos: VehiclePhotoResponse[]) => {
    if (!canReadDocs || photos.length === 0) return;
    const urls: Record<string, string> = {};
    await Promise.all(
      photos.map(async (p) => {
        try {
          const r = await apiFetch<{ url: string }>(
            `/api/files/signed-url?fileId=${encodeURIComponent(p.id)}`
          );
          urls[p.id] = r.url;
        } catch {
          // skip
        }
      })
    );
    setPhotoUrls((prev) => ({ ...prev, ...urls }));
  }, [canReadDocs]);

  React.useEffect(() => {
    if (vehicle?.photos?.length && activeTab === "photos") {
      fetchPhotoUrls(vehicle.photos);
    }
  }, [vehicle?.photos, activeTab, fetchPhotoUrls]);

  const handleStatusChange = async (newStatus: string) => {
    if (!canWrite || !vehicle) return;
    setStatusUpdating(true);
    try {
      await apiFetch(`/api/inventory/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setVehicle((v) => (v ? { ...v, status: newStatus } : null));
      addToast("success", "Status updated");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!canWrite) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/inventory/${id}`, {
        method: "DELETE",
        expectNoContent: true,
      });
      addToast("success", "Vehicle deleted");
      router.push("/inventory");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canWrite || !canWriteDocs) return;
    e.target.value = "";
    setPhotoUploadError(null);
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      await apiFetch<{ data: VehiclePhotoResponse }>(`/api/inventory/${id}/photos`, {
        method: "POST",
        body: formData,
      });
      addToast("success", "Photo uploaded");
      fetchVehicle();
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don’t have access to inventory.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to inventory
        </Link>
        <ErrorState title="Vehicle not found" message="It may have been deleted." onRetry={() => router.push("/inventory")} />
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="space-y-6">
        <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to inventory
        </Link>
        <ErrorState message={error ?? "Vehicle not found"} onRetry={fetchVehicle} />
      </div>
    );
  }

  const statusOptions: SelectOption[] = VEHICLE_STATUS_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/inventory" className="text-sm text-[var(--accent)] hover:underline">
            ← Back to inventory
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            {vehicle.stockNumber} — {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
          </h1>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <WriteGuard>
              <Link href={`/inventory/${id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
              <Button
                variant="danger"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete
              </Button>
            </WriteGuard>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} aria-label="Vehicle sections">
        <TabsList>
          <TabsTrigger
            value="overview"
            selected={activeTab === "overview"}
            onSelect={() => setActiveTab("overview")}
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            selected={activeTab === "photos"}
            onSelect={() => setActiveTab("photos")}
          >
            Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" selected={activeTab === "overview"}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Stock #</dt>
                  <dd className="font-medium">{vehicle.stockNumber}</dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">VIN</dt>
                  <dd className="font-mono text-sm">{vehicle.vin ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Year / Make / Model</dt>
                  <dd>
                    {[vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Mileage</dt>
                  <dd>{vehicle.mileage != null ? vehicle.mileage.toLocaleString() : "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Color</dt>
                  <dd>{vehicle.color ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Status</dt>
                  <dd>
                    {canWrite ? (
                      <WriteGuard>
                        <Select
                          options={statusOptions}
                          value={vehicle.status}
                          onChange={handleStatusChange}
                          disabled={statusUpdating}
                          className="w-40"
                        />
                      </WriteGuard>
                    ) : (
                      vehicle.status
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Sale price</dt>
                  <dd>
                    {getSalePriceCents(vehicle) !== ""
                      ? formatCents(getSalePriceCents(vehicle))
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Auction cost</dt>
                  <dd>
                    {getAuctionCostCents(vehicle) !== ""
                      ? formatCents(getAuctionCostCents(vehicle))
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Transport cost</dt>
                  <dd>
                    {transportCostCents(vehicle) !== ""
                      ? formatCents(transportCostCents(vehicle))
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Reconditioning cost</dt>
                  <dd>
                    {getReconCostCents(vehicle) !== ""
                      ? formatCents(getReconCostCents(vehicle))
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Misc costs</dt>
                  <dd>
                    {getMiscCostCents(vehicle) !== ""
                      ? formatCents(getMiscCostCents(vehicle))
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Projected gross</dt>
                  <dd className="font-medium">
                    {vehicle.projectedGrossCents != null && vehicle.projectedGrossCents !== ""
                      ? formatCents(vehicle.projectedGrossCents)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Location</dt>
                  <dd>{vehicle.location?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--text-soft)]">Days in stock</dt>
                  <dd>{daysInStock(vehicle.createdAt)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" selected={activeTab === "photos"}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canReadDocs ? (
                <p className="text-[var(--text-soft)]">You need documents.read to view photos.</p>
              ) : (
                <>
                  {canWrite && canWriteDocs && (
                    <WriteGuard>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text)] mb-1">
                          Upload photo
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={photoUploading}
                          className="block w-full text-sm text-[var(--text-soft)] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[var(--accent)] file:text-white hover:file:bg-[var(--accent-hover)]"
                          aria-label="Choose photo to upload"
                        />
                      {photoUploading && <p className="mt-1 text-sm text-[var(--text-soft)]">Uploading…</p>}
                      {photoUploadError && (
                        <p className="mt-1 text-sm text-[var(--danger)]">{photoUploadError}</p>
                      )}
                      </div>
                    </WriteGuard>
                  )}
                  {vehicle.photos?.length === 0 ? (
                    <p className="text-[var(--text-soft)]">No photos yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                      {vehicle.photos?.map((p) => (
                        <div key={p.id} className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--muted)]">
                          {photoUrls[p.id] ? (
                            <a
                              href={photoUrls[p.id]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block aspect-[4/3]"
                            >
                              <img
                                src={photoUrls[p.id]}
                                alt={p.filename}
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ) : (
                            <div className="aspect-[4/3] flex items-center justify-center text-[var(--text-soft)] text-sm">
                              Loading…
                            </div>
                          )}
                          <p className="p-2 text-xs text-[var(--text-soft)] truncate" title={p.filename}>
                            {p.filename}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogHeader>
          <DialogTitle>Delete vehicle?</DialogTitle>
          <DialogDescription>
            This will remove the vehicle from inventory. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <MutationButton variant="danger" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? "Deleting…" : "Delete"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
