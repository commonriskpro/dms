"use client";

import * as React from "react";
import { MoreHorizontal, Plus, Star, Trash2 } from "@/lib/ui/icons";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WriteGuard } from "@/components/write-guard";
import type { VehiclePhotoListResponse } from "../types";

const MAX_PHOTOS = 20;
const PHOTOS_API = (id: string) => `/api/inventory/${id}/photos`;

export type VehiclePhotosManagerProps = {
  vehicleId: string;
  canReadDocs?: boolean;
  canWrite?: boolean;
  canWriteDocs?: boolean;
  onPhotosChange?: () => void;
};

export function VehiclePhotosManager({
  vehicleId,
  canReadDocs = false,
  canWrite = false,
  canWriteDocs = false,
  onPhotosChange,
}: VehiclePhotosManagerProps) {
  const { addToast } = useToast();
  const confirm = useConfirm();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = React.useState<VehiclePhotoListResponse[]>([]);
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [photoUploadError, setPhotoUploadError] = React.useState<string | null>(null);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);

  const fetchPhotos = React.useCallback(async () => {
    if (!canReadDocs) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch<{ data: VehiclePhotoListResponse[] }>(
        PHOTOS_API(vehicleId)
      );
      const list = res.data ?? [];
      setPhotos(list.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, canReadDocs]);

  React.useEffect(() => {
    setLoading(true);
    fetchPhotos();
  }, [fetchPhotos]);

  const fetchPhotoUrls = React.useCallback(
    async (list: VehiclePhotoListResponse[]) => {
      if (!canReadDocs || list.length === 0) return;
      const urls: Record<string, string> = {};
      await Promise.all(
        list.map(async (p) => {
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
    },
    [canReadDocs]
  );

  React.useEffect(() => {
    if (photos.length > 0) fetchPhotoUrls(photos);
  }, [photos, fetchPhotoUrls]);

  const uploadFiles = React.useCallback(
    async (files: File[]) => {
      if (!files.length || !canWrite || !canWriteDocs) return;
      setPhotoUploadError(null);
      setPhotoUploading(true);
      const toUpload = files.filter((f) => f.type.startsWith("image/"));
      try {
        for (const file of toUpload) {
          const formData = new FormData();
          formData.set("file", file);
          await apiFetch<{ data: VehiclePhotoListResponse }>(
            PHOTOS_API(vehicleId),
            { method: "POST", body: formData }
          );
        }
        if (toUpload.length > 0) {
          addToast("success", toUpload.length === 1 ? "Photo uploaded" : "Photos uploaded");
          onPhotosChange?.();
          await fetchPhotos();
        }
      } catch (err) {
        setPhotoUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setPhotoUploading(false);
      }
    },
    [vehicleId, canWrite, canWriteDocs, addToast, onPhotosChange, fetchPhotos]
  );

  const handlePhotoUpload = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      uploadFiles(Array.from(files));
      e.target.value = "";
    },
    [uploadFiles]
  );

  const handleSetPrimary = React.useCallback(
    async (fileId: string) => {
      if (!canWrite || !canWriteDocs) return;
      const idx = photos.findIndex((p) => p.id === fileId);
      if (idx <= 0) return;
      const newOrder = [
        photos[idx].id,
        ...photos.slice(0, idx).map((p) => p.id),
        ...photos.slice(idx + 1).map((p) => p.id),
      ];
      setPhotos((prev) => {
        const next = prev.map((p) => ({ ...p, isPrimary: p.id === fileId }));
        const from = next.findIndex((p) => p.id === fileId);
        if (from <= 0) return next;
        const item = next.splice(from, 1)[0];
        next.unshift(item);
        return next;
      });
      try {
        await apiFetch(PHOTOS_API(vehicleId) + "/primary", {
          method: "PATCH",
          body: JSON.stringify({ fileId }),
        });
        await apiFetch(PHOTOS_API(vehicleId) + "/reorder", {
          method: "PATCH",
          body: JSON.stringify({ fileIds: newOrder }),
        });
        addToast("success", "Primary photo updated");
        onPhotosChange?.();
      } catch (e) {
        await fetchPhotos();
        addToast("error", e instanceof Error ? e.message : "Failed to set primary");
      }
    },
    [vehicleId, photos, canWrite, canWriteDocs, addToast, onPhotosChange, fetchPhotos]
  );

  const handleDelete = React.useCallback(
    async (fileId: string) => {
      if (!canWrite || !canWriteDocs) return;
      const ok = await confirm({
        title: "Delete photo?",
        description: "This cannot be undone.",
        confirmText: "Delete",
        cancelText: "Cancel",
        variant: "danger",
      });
      if (!ok) return;
      try {
        await apiFetch(`/api/inventory/${vehicleId}/photos/${fileId}`, {
          method: "DELETE",
          expectNoContent: true,
        });
        addToast("success", "Photo deleted");
        onPhotosChange?.();
        await fetchPhotos();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to delete photo");
      }
    },
    [vehicleId, canWrite, canWriteDocs, confirm, addToast, onPhotosChange, fetchPhotos]
  );

  const handleReorder = React.useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || !canWrite || !canWriteDocs) return;
      const reordered = [...photos];
      const [removed] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, removed);
      const fileIds = reordered.map((p) => p.id);
      const prevPhotos = [...photos];
      setPhotos(reordered);
      try {
        await apiFetch(PHOTOS_API(vehicleId) + "/reorder", {
          method: "PATCH",
          body: JSON.stringify({ fileIds }),
        });
        addToast("success", "Order updated");
        onPhotosChange?.();
      } catch (e) {
        setPhotos(prevPhotos);
        addToast("error", e instanceof Error ? e.message : "Failed to reorder");
      }
    },
    [vehicleId, photos, canWrite, canWriteDocs, addToast, onPhotosChange]
  );

  const onAddClick = () => fileInputRef.current?.click();
  const canManage = canWrite && canWriteDocs;
  const isAtLimit = photos.length >= MAX_PHOTOS;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-soft)]">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base text-[var(--text)]">Photos</CardTitle>
        {canReadDocs && (
          <span className="text-sm text-[var(--text-soft)]">
            {photos.length} / {MAX_PHOTOS}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-5 px-4 pb-5 pt-1">
        {!canReadDocs ? (
          <p className="text-[var(--text-soft)]">You need documents.read to view photos.</p>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              disabled={photoUploading || isAtLimit}
              className="sr-only"
              aria-label="Choose photos to upload"
            />
            {canManage && (
              <WriteGuard>
                {photoUploading && (
                  <p className="text-sm text-[var(--text-soft)]">Uploading…</p>
                )}
                {photoUploadError && (
                  <p className="text-sm text-[var(--text)]">{photoUploadError}</p>
                )}
              </WriteGuard>
            )}

            {photos.length === 0 && canManage ? (
              <div className="flex w-full flex-col items-center justify-center py-8">
                <div
                  role="button"
                  tabIndex={0}
                  aria-disabled={photoUploading}
                  onClick={() => !photoUploading && onAddClick()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!photoUploading) onAddClick();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = e.dataTransfer?.files;
                    if (files?.length) {
                      uploadFiles(Array.from(files));
                    }
                  }}
                  className="flex min-h-[280px] w-full max-w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)] px-8 py-14 text-center transition hover:border-[var(--accent)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
                  aria-label="Add vehicle photos"
                >
                  <Plus className="mb-4 h-14 w-14 text-[var(--muted-text)]" aria-hidden />
                  <p className="text-base font-medium text-[var(--text)]">Add vehicle photos</p>
                  <p className="mt-2 text-sm text-[var(--muted-text)]">
                    Drag photos here or click to upload
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p, index) => (
                  <div
                    key={p.id}
                    draggable={canManage}
                    onDragStart={() => setDraggedId(p.id)}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    onDragOver={(e) => {
                      if (!canManage || !draggedId || draggedId === p.id) return;
                      e.preventDefault();
                      setDragOverId(p.id);
                    }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverId(null);
                      if (!canManage || !draggedId || draggedId === p.id) return;
                      const fromIndex = photos.findIndex((x) => x.id === draggedId);
                      const toIndex = photos.findIndex((x) => x.id === p.id);
                      if (fromIndex !== -1 && toIndex !== -1) {
                        handleReorder(fromIndex, toIndex);
                      }
                      setDraggedId(null);
                    }}
                    className={`group/item relative rounded-lg border overflow-hidden bg-[var(--surface)] transition hover:border-[var(--accent)] hover:ring-2 hover:ring-[var(--ring)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)] ${
                      dragOverId === p.id
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
                        : "border-[var(--border)]"
                    } ${draggedId === p.id ? "opacity-50" : ""}`}
                  >
                    {photoUrls[p.id] ? (
                      <a
                        href={photoUrls[p.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-[4/3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed/remote vehicle photo URLs; next/image not used to avoid loader config for dynamic URLs */}
                        <img
                          src={photoUrls[p.id]}
                          alt={p.filename}
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--surface)]/70 text-xs font-medium text-[var(--text)] opacity-0 transition group-hover/item:opacity-100 pointer-events-none">
                          View / Manage
                        </span>
                      </a>
                    ) : (
                      <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-[var(--text-soft)]">
                        Loading…
                      </div>
                    )}
                    {p.isPrimary && (
                      <div className="absolute left-2 top-2">
                        <Badge variant="outline" className="text-[var(--text)]">
                          Primary
                        </Badge>
                      </div>
                    )}
                    {canManage && (
                      <div className="absolute right-2 top-2 opacity-0 transition group-hover/item:opacity-100 group-focus-within:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--muted)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                              aria-label="Photo actions"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleSetPrimary(p.id)}
                              disabled={p.isPrimary}
                            >
                              <Star className="mr-2 h-4 w-4" aria-hidden />
                              Set as primary
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(p.id)}
                              className="text-[var(--danger)] focus:text-[var(--danger)]"
                            >
                              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ))}
                {canManage && !isAtLimit && (
                  <button
                    type="button"
                    onClick={onAddClick}
                    disabled={photoUploading}
                    className="flex aspect-[4/3] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-soft)] transition hover:bg-[var(--surface)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    aria-label="Add photos"
                  >
                    <Plus className="h-8 w-8" aria-hidden />
                    <span className="text-sm">Add photos</span>
                  </button>
                )}
              </div>
            )}

            <p className="text-xs text-[var(--text-soft)]">
              Tip: First photos appear in listings
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
