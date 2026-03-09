"use client";

import * as React from "react";
import { Image, MoreHorizontal, Plus, Star, Trash2 } from "@/lib/ui/icons";
import { Badge } from "@/components/ui/badge";
import {
  DMSCard,
  DMSCardContent,
  DMSCardHeader,
  DMSCardTitle,
} from "@/components/ui/dms-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { VehiclePhotoListResponse } from "../types";

export type PhotoGalleryCardProps = {
  photos: VehiclePhotoListResponse[];
  photoUrls: Record<string, string>;
  canReadDocs: boolean;
  canManage: boolean;
  photoUploading: boolean;
  photoUploadError: string | null;
  isAtLimit: boolean;
  onRequestUpload: () => void;
  onSetPrimary: (fileId: string) => void;
  onDelete: (fileId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

export function PhotoGalleryCard({
  photos,
  photoUrls,
  canReadDocs,
  canManage,
  photoUploading,
  photoUploadError,
  isAtLimit,
  onRequestUpload,
  onSetPrimary,
  onDelete,
  onReorder,
}: PhotoGalleryCardProps) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);

  return (
    <DMSCard>
      <DMSCardHeader className="flex flex-row items-center justify-between">
        <DMSCardTitle>Photos</DMSCardTitle>
        {canReadDocs ? (
          <span className="text-sm text-[var(--text-soft)]">{photos.length} / 20</span>
        ) : null}
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        {!canReadDocs ? (
          <p className="text-sm text-[var(--text-soft)]">You need documents.read to view photos.</p>
        ) : (
          <>
            {canManage && photoUploading ? (
              <p className="text-sm text-[var(--text-soft)]">Uploading photos...</p>
            ) : null}
            {canManage && photoUploadError ? (
              <p className="text-sm text-[var(--danger)]">{photoUploadError}</p>
            ) : null}

            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Image className="mb-2 h-8 w-8 text-[var(--muted-text)]" aria-hidden />
                <p className="text-sm text-[var(--text-soft)]">
                  No photos yet. Use the Upload Media panel to add images.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    draggable={canManage}
                    onDragStart={() => setDraggedId(photo.id)}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
                    onDragOver={(event) => {
                      if (!canManage || !draggedId || draggedId === photo.id) return;
                      event.preventDefault();
                      setDragOverId(photo.id);
                    }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragOverId(null);
                      if (!canManage || !draggedId || draggedId === photo.id) return;
                      const fromIndex = photos.findIndex((item) => item.id === draggedId);
                      const toIndex = photos.findIndex((item) => item.id === photo.id);
                      if (fromIndex !== -1 && toIndex !== -1) onReorder(fromIndex, toIndex);
                      setDraggedId(null);
                    }}
                    className={cn(
                      "group/item relative overflow-hidden rounded-lg border bg-[var(--surface)] transition",
                      dragOverId === photo.id
                        ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
                        : "border-[var(--border)] hover:border-[var(--accent)] hover:ring-2 hover:ring-[var(--ring)]",
                      draggedId === photo.id ? "opacity-50" : ""
                    )}
                  >
                    {photoUrls[photo.id] ? (
                      <a
                        href={photoUrls[photo.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-[4/3]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from storage API */}
                        <img
                          src={photoUrls[photo.id]}
                          alt={photo.filename}
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--surface)]/70 text-xs font-medium text-[var(--text)] opacity-0 transition group-hover/item:opacity-100">
                          View / Manage
                        </span>
                      </a>
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center text-sm text-[var(--text-soft)]">
                        Loading...
                      </div>
                    )}

                    {index === 0 || photo.isPrimary ? (
                      <div className="absolute left-2 top-2">
                        <Badge variant="outline" className="text-[var(--text)]">
                          Primary
                        </Badge>
                      </div>
                    ) : null}

                    {canManage ? (
                      <div className="absolute right-2 top-2 opacity-0 transition group-hover/item:opacity-100 group-focus-within:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                              aria-label="Photo actions"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onSetPrimary(photo.id)}
                              disabled={index === 0 || photo.isPrimary}
                            >
                              <Star className="mr-2 h-4 w-4" aria-hidden />
                              Set as primary
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDelete(photo.id)}
                              className="text-[var(--danger)] focus:text-[var(--danger)]"
                            >
                              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : null}
                  </div>
                ))}
                {canManage && !isAtLimit ? (
                  <button
                    type="button"
                    onClick={onRequestUpload}
                    disabled={photoUploading}
                    className="flex aspect-[4/3] items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-soft)] transition hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    aria-label="Add photos"
                  >
                    <Plus className="h-6 w-6" aria-hidden />
                    <span className="text-sm">Add</span>
                  </button>
                ) : null}
              </div>
            )}

            <p className="text-xs text-[var(--text-soft)]">
              Tip: Photo order controls the listing gallery cover and sequence.
            </p>
          </>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
