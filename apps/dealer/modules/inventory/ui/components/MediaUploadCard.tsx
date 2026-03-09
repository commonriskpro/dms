"use client";

import * as React from "react";
import { Image, Plus, Upload } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import {
  DMSCard,
  DMSCardContent,
  DMSCardHeader,
  DMSCardTitle,
} from "@/components/ui/dms-card";
import { cn } from "@/lib/utils";

export type MediaUploadCardProps = {
  canManage: boolean;
  photoCount: number;
  photoLimit: number;
  videoCount: number;
  videoLimit: number;
  photoUploading: boolean;
  videoUploading: boolean;
  photoUploadError: string | null;
  videoUploadError: string | null;
  onUploadPhotos: () => void;
  onUploadVideos: () => void;
  onDropFiles: (files: File[]) => void;
};

export function MediaUploadCard({
  canManage,
  photoCount,
  photoLimit,
  videoCount,
  videoLimit,
  photoUploading,
  videoUploading,
  photoUploadError,
  videoUploadError,
  onUploadPhotos,
  onUploadVideos,
  onDropFiles,
}: MediaUploadCardProps) {
  const busy = photoUploading || videoUploading;

  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Upload Media</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        <div
          role={canManage ? "button" : undefined}
          tabIndex={canManage ? 0 : undefined}
          onKeyDown={(event) => {
            if (!canManage || busy) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onUploadPhotos();
            }
          }}
          onDragOver={(event) => {
            if (!canManage) return;
            event.preventDefault();
            event.stopPropagation();
          }}
          onDrop={(event) => {
            if (!canManage) return;
            event.preventDefault();
            const files = event.dataTransfer?.files;
            if (files?.length) onDropFiles(Array.from(files));
          }}
          className={cn(
            "rounded-xl border-2 border-dashed px-4 py-6 transition",
            canManage
              ? "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--accent)] hover:bg-[var(--surface)]"
              : "border-[var(--border)] bg-[var(--surface-2)]"
          )}
        >
          <div className="flex flex-col items-center text-center">
            <Upload className="mb-2 h-8 w-8 text-[var(--muted-text)]" aria-hidden />
            <p className="text-sm font-medium text-[var(--text)]">Drag files here</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">
              JPG, PNG, WEBP for photos and MP4, MOV, WEBM for videos
            </p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Maximum file size: 25MB</p>
          </div>
        </div>

        {canManage ? (
          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={onUploadPhotos}
              disabled={busy || photoCount >= photoLimit}
              className="w-full justify-center"
            >
              <Image className="mr-2 h-4 w-4" aria-hidden />
              Upload photos
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onUploadVideos}
              disabled={busy || videoCount >= videoLimit}
              className="w-full justify-center"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Upload videos
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-soft)]">
            You need inventory.write and documents.write to upload media.
          </p>
        )}

        <div className="space-y-1 text-xs text-[var(--text-soft)]">
          <p>
            Photos: {photoCount} / {photoLimit}
          </p>
          <p>
            Videos: {videoCount} / {videoLimit}
          </p>
        </div>

        {photoUploadError ? <p className="text-xs text-[var(--danger)]">{photoUploadError}</p> : null}
        {videoUploadError ? <p className="text-xs text-[var(--danger)]">{videoUploadError}</p> : null}
      </DMSCardContent>
    </DMSCard>
  );
}
