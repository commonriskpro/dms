"use client";

import * as React from "react";
import { MoreHorizontal, Plus, Star, Trash2 } from "@/lib/ui/icons";
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

export type MediaVideoItem = {
  id: string;
  name: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
  isPrimary: boolean;
};

export type VideoGalleryCardProps = {
  videos: MediaVideoItem[];
  canManage: boolean;
  videoUploading: boolean;
  videoUploadError: string | null;
  isAtLimit: boolean;
  onRequestUpload: () => void;
  onSetPrimary: (videoId: string) => void;
  onDelete: (videoId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

export function VideoGalleryCard({
  videos,
  canManage,
  videoUploading,
  videoUploadError,
  isAtLimit,
  onRequestUpload,
  onSetPrimary,
  onDelete,
  onReorder,
}: VideoGalleryCardProps) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);

  return (
    <DMSCard>
      <DMSCardHeader className="flex flex-row items-center justify-between">
        <DMSCardTitle>Videos</DMSCardTitle>
        <span className="text-sm text-[var(--text-soft)]">{videos.length} / 8</span>
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        {videoUploading ? <p className="text-sm text-[var(--text-soft)]">Uploading videos...</p> : null}
        {videoUploadError ? <p className="text-sm text-[var(--danger)]">{videoUploadError}</p> : null}

        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-[var(--text-soft)]">
              No videos yet. Use the Upload Media panel to add videos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video, index) => (
              <div
                key={video.id}
                draggable={canManage}
                onDragStart={() => setDraggedId(video.id)}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDragOver={(event) => {
                  if (!canManage || !draggedId || draggedId === video.id) return;
                  event.preventDefault();
                  setDragOverId(video.id);
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverId(null);
                  if (!canManage || !draggedId || draggedId === video.id) return;
                  const fromIndex = videos.findIndex((item) => item.id === draggedId);
                  const toIndex = videos.findIndex((item) => item.id === video.id);
                  if (fromIndex !== -1 && toIndex !== -1) onReorder(fromIndex, toIndex);
                  setDraggedId(null);
                }}
                className={cn(
                  "group/item relative overflow-hidden rounded-lg border bg-[var(--surface)] transition",
                  dragOverId === video.id
                    ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--accent)] hover:ring-2 hover:ring-[var(--ring)]",
                  draggedId === video.id ? "opacity-50" : ""
                )}
              >
                <video src={video.url} className="aspect-video w-full bg-black object-cover" controls />
                {index === 0 || video.isPrimary ? (
                  <span className="absolute left-2 top-2 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text)]">
                    Primary
                  </span>
                ) : null}
                <div className="absolute bottom-2 left-2 max-w-[70%] truncate rounded bg-[var(--surface)]/85 px-2 py-0.5 text-xs text-[var(--text)]">
                  {video.name}
                </div>
                {canManage ? (
                  <div className="absolute right-2 top-2 opacity-0 transition group-hover/item:opacity-100 group-focus-within:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                          aria-label="Video actions"
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onSetPrimary(video.id)}
                          disabled={index === 0 || video.isPrimary}
                        >
                          <Star className="mr-2 h-4 w-4" aria-hidden />
                          Set as primary
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(video.id)}
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
                disabled={videoUploading}
                className="flex aspect-video items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-soft)] transition hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Plus className="h-5 w-5" aria-hidden />
                <span className="text-sm">Add video</span>
              </button>
            ) : null}
          </div>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}
