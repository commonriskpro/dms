"use client";

import * as React from "react";
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { VEHICLE_STATUS_OPTIONS } from "@/modules/inventory/ui/types";

const statusOptions: SelectOption[] = [
  { value: "", label: "Select status" },
  ...VEHICLE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
];

const FLOORPLAN_OPTIONS: SelectOption[] = [
  { value: "", label: "No Floorplan Assigned" },
  { value: "floorplan-1", label: "Floorplan 1" },
  { value: "floorplan-2", label: "Floorplan 2" },
];

export interface PhotosStatusCardProps {
  status: string;
  onStatusChange: (v: string) => void;
  floorplan: string;
  onFloorplanChange: (v: string) => void;
  postOnline: boolean;
  onPostOnlineChange: (v: boolean) => void;
  postFacebook: boolean;
  onPostFacebookChange: (v: boolean) => void;
  postWebsite: boolean;
  onPostWebsiteChange: (v: boolean) => void;
  postMarketplace: boolean;
  onPostMarketplaceChange: (v: boolean) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  photoUrls?: string[];
  onUploadPhotos?: () => void;
}

export function PhotosStatusCard({
  status,
  onStatusChange,
  floorplan,
  onFloorplanChange,
  postOnline,
  onPostOnlineChange,
  postFacebook,
  onPostFacebookChange,
  postWebsite,
  onPostWebsiteChange,
  postMarketplace,
  onPostMarketplaceChange,
  notes,
  onNotesChange,
  photoUrls = [],
  onUploadPhotos,
}: PhotosStatusCardProps) {
  return (
    <DMSCard>
      <DMSCardHeader>
        <DMSCardTitle>Photos & Status</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="space-y-4">
        <div className="space-y-2">
          <span className="text-sm font-medium text-[var(--text)]">Status & Floorplan</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Status"
              options={statusOptions}
              value={status}
              onChange={onStatusChange}
            />
            <Select
              label="Floorplan"
              options={FLOORPLAN_OPTIONS}
              value={floorplan}
              onChange={onFloorplanChange}
            />
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium text-[var(--text)]">Photos & Media</span>
          {onUploadPhotos && (
            <Button type="button" onClick={onUploadPhotos}>
              <CameraIcon className="mr-2 h-4 w-4" />
              Upload Photos
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium text-[var(--text)]">Publishing</span>
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={postOnline}
                onChange={(e) => onPostOnlineChange(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              Post Online
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={postFacebook}
                onChange={(e) => onPostFacebookChange(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              Facebook
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={postWebsite}
                onChange={(e) => onPostWebsiteChange(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              Website
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={postMarketplace}
                onChange={(e) => onPostMarketplaceChange(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              Marketplace
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="add-vehicle-notes" className="mb-1 block text-sm font-medium text-[var(--text)]">
            Additional notes about the vehicle…
          </label>
          <textarea
            id="add-vehicle-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            placeholder="Additional notes about the vehicle…"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0"
          />
        </div>
        {photoUrls.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {photoUrls.map((url, i) => (
              <div
                key={i}
                className="h-20 w-28 shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)]"
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </DMSCardContent>
    </DMSCard>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
