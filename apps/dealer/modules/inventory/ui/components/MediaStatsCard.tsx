"use client";

import * as React from "react";
import {
  DMSCard,
  DMSCardContent,
  DMSCardHeader,
  DMSCardTitle,
} from "@/components/ui/dms-card";

export type MediaStatsCardProps = {
  photoCount: number;
  videoCount: number;
  photoLimit: number;
  videoLimit: number;
  primaryPhotoUrl: string | null;
  primaryPhotoName: string | null;
  primaryVideoName: string | null;
};

export function MediaStatsCard({
  photoCount,
  videoCount,
  photoLimit,
  videoLimit,
  primaryPhotoUrl,
  primaryPhotoName,
  primaryVideoName,
}: MediaStatsCardProps) {
  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Media Summary</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        {primaryPhotoUrl ? (
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from storage API */}
            <img
              src={primaryPhotoUrl}
              alt={primaryPhotoName ?? "Primary photo"}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-soft)]">
            No primary photo
          </div>
        )}

        <div className="space-y-2 text-sm text-[var(--text)]">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-soft)]">Total photos</span>
            <span>
              {photoCount} / {photoLimit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-soft)]">Total videos</span>
            <span>
              {videoCount} / {videoLimit}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-soft)]">Primary photo</span>
            <span className="max-w-[60%] truncate text-right">
              {primaryPhotoName ?? "Not set"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--text-soft)]">Primary video</span>
            <span className="max-w-[60%] truncate text-right">
              {primaryVideoName ?? "Not set"}
            </span>
          </div>
        </div>

        <p className="text-xs text-[var(--text-soft)]">
          Keep your best hero media first. Primary photo and video are featured across listing surfaces.
        </p>
      </DMSCardContent>
    </DMSCard>
  );
}
