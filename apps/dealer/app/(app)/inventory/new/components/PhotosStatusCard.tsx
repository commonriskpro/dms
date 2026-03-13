"use client";

import * as React from "react";
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { Select, type SelectOption } from "@/components/ui/select";
import { FancySelect } from "@/components/ui/fancy-select";
import { Skeleton } from "@/components/ui/skeleton";
import { VEHICLE_STATUS_OPTIONS } from "@/modules/inventory/ui/types";
import { modalDepthInteractive, modalDepthSurface, modalFieldTone } from "@/lib/ui/modal-depth";

const MAX_PHOTOS = 20;

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
  notes: string;
  onNotesChange: (v: string) => void;
  photoUrls?: string[];
  /** Called when photos are added, reordered, deleted, or primary is set. */
  onPhotosChange?: (urls: string[]) => void;
  /** @deprecated Use onPhotosChange; kept for compatibility. Triggered when user requests upload (opens picker). */
  onUploadPhotos?: () => void;
  compact?: boolean;
}

export function PhotosStatusCard({
  status,
  onStatusChange,
  floorplan,
  onFloorplanChange,
  notes,
  onNotesChange,
  photoUrls = [],
  onPhotosChange,
  onUploadPhotos,
  compact = false,
}: PhotosStatusCardProps) {
  const modalControlClass = `${modalFieldTone} h-10`;
  const modalLabelClass = "text-[13px] font-medium text-[var(--text-soft)]/88";
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const urls = photoUrls;
  const canAdd = urls.length < MAX_PHOTOS;
  const primaryUrl = urls[selectedIndex] ?? urls[0];
  const effectiveIndex = selectedIndex >= urls.length ? 0 : selectedIndex;

  React.useEffect(() => {
    if (effectiveIndex !== selectedIndex) setSelectedIndex(effectiveIndex);
  }, [urls.length, effectiveIndex, selectedIndex]);

  const triggerFilePicker = React.useCallback(() => {
    if (!canAdd) return;
    fileInputRef.current?.click();
  }, [canAdd]);

  const handleFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length || !onPhotosChange) return;
      const newUrls: string[] = [];
      for (let i = 0; i < files.length && urls.length + newUrls.length < MAX_PHOTOS; i++) {
        newUrls.push(URL.createObjectURL(files[i]));
      }
      if (newUrls.length) onPhotosChange([...urls, ...newUrls]);
      e.target.value = "";
    },
    [urls, onPhotosChange]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (!canAdd || !onPhotosChange) return;
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      const newUrls: string[] = [];
      for (let i = 0; i < files.length && urls.length + newUrls.length < MAX_PHOTOS; i++) {
        newUrls.push(URL.createObjectURL(files[i]));
      }
      if (newUrls.length) onPhotosChange([...urls, ...newUrls]);
    },
    [canAdd, urls, onPhotosChange]
  );

  const handleSetPrimary = React.useCallback(
    (index: number) => {
      if (!onPhotosChange || index === 0) return;
      const next = [urls[index], ...urls.slice(0, index), ...urls.slice(index + 1)];
      onPhotosChange(next);
      setSelectedIndex(0);
    },
    [urls, onPhotosChange]
  );

  const handleDelete = React.useCallback(
    (index: number) => {
      if (!onPhotosChange) return;
      const next = urls.filter((_, i) => i !== index);
      onPhotosChange(next);
      setSelectedIndex(Math.min(selectedIndex, Math.max(0, next.length - 1)));
    },
    [urls, selectedIndex, onPhotosChange]
  );

  const handleReorder = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!onPhotosChange || fromIndex === toIndex) return;
      const arr = [...urls];
      const [removed] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, removed);
      onPhotosChange(arr);
      const prevUrl = urls[selectedIndex];
      const newIndex = arr.indexOf(prevUrl);
      setSelectedIndex(newIndex >= 0 ? newIndex : 0);
    },
    [urls, selectedIndex, onPhotosChange]
  );

  const content = (
    <>
      <div className="space-y-2.5">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {compact ? (
            <FancySelect
              label="Status"
              options={statusOptions}
              value={status}
              onChange={onStatusChange}
              triggerClassName={modalControlClass}
              labelClassName={modalLabelClass}
            />
          ) : (
            <Select
              label="Status"
              options={statusOptions}
              value={status}
              onChange={onStatusChange}
              className={modalFieldTone}
            />
          )}
          {compact ? (
            <FancySelect
              label="Floorplan"
              options={FLOORPLAN_OPTIONS}
              value={floorplan}
              onChange={onFloorplanChange}
              triggerClassName={modalControlClass}
              labelClassName={modalLabelClass}
            />
          ) : (
            <Select
              label="Floorplan"
              options={FLOORPLAN_OPTIONS}
              value={floorplan}
              onChange={onFloorplanChange}
              className={modalFieldTone}
            />
          )}
        </div>
      </div>

      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-[var(--text)]">Photos & Media</span>
          <span className="text-sm tabular-nums text-[var(--text-soft)]">
            {urls.length} / {MAX_PHOTOS}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
          aria-hidden
        />
        <div className={urls.length === 0 ? "min-w-0" : `${modalDepthInteractive} min-w-0 p-2.5 space-y-2`}>
          {urls.length === 0 ? (
            <button
              type="button"
              onClick={triggerFilePicker}
              onDragOver={(e) => {
                e.preventDefault();
                if (canAdd) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex h-[220px] w-full flex-col items-center justify-center gap-1 rounded-[18px] border border-dashed border-[color:rgba(148,163,184,0.2)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.026)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors lg:h-[280px] ${isDragging ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.075)_0%,rgba(255,255,255,0.04)_100%)]" : "hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.065)_0%,rgba(255,255,255,0.035)_100%)]"}`}
              style={isDragging ? { borderColor: "var(--accent)" } : undefined}
            >
              <span className="text-sm font-medium text-[var(--text)]/95">Drag photos here</span>
              <span className="text-sm text-[var(--text-soft)]/90">or click to upload</span>
            </button>
          ) : (
            <>
              <div className="relative h-[220px] w-full overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)] lg:h-[280px]">
                {primaryUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs for upload preview; next/image does not support blob URLs */}
                    <img src={primaryUrl} alt="" className="h-full w-full object-cover" />
                  </>
                ) : (
                  <Skeleton className="h-full w-full rounded-none" />
                )}
                <div className="absolute right-2 top-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(effectiveIndex)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                    aria-label="Set as primary"
                  >
                    <StarIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(effectiveIndex)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                    aria-label="Delete photo"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {urls.map((url, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setDropTargetIndex(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragIndex !== null && dragIndex !== i) setDropTargetIndex(i);
                    }}
                    onDragLeave={() => setDropTargetIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const toIndex = Number((e.currentTarget as HTMLElement).dataset.index);
                      if (dragIndex !== null && !Number.isNaN(toIndex) && dragIndex !== toIndex) {
                        handleReorder(dragIndex, toIndex);
                      }
                      setDragIndex(null);
                      setDropTargetIndex(null);
                    }}
                    data-index={i}
                    className={`relative h-14 w-20 shrink-0 cursor-pointer overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)] ${effectiveIndex === i ? "ring-2 ring-[var(--accent)]" : ""} ${dropTargetIndex === i ? "ring-2 ring-[var(--accent)]" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(i)}
                      className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs for upload preview; next/image does not support blob URLs */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-0.5 left-0.5 rounded bg-[var(--surface)] px-1 py-0 text-[9px] font-medium text-[var(--text)]">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
                {canAdd && (
                  <button
                    type="button"
                    onClick={triggerFilePicker}
                    className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-[color:rgba(148,163,184,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%)] text-[var(--text-soft)] transition-colors hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)]"
                    aria-label="Add photo"
                  >
                    <span className="text-xl leading-none">+</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
          <label htmlFor="add-vehicle-notes" className="mb-1 block text-[13px] font-medium text-[var(--text-soft)]/88">
            Additional notes about the vehicle…
          </label>
          <textarea
            id="add-vehicle-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            placeholder="Additional notes about the vehicle…"
            className={`h-10 w-full rounded-md px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-soft)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-0 ${modalFieldTone}`}
          />
      </div>
    </>
  );

  if (compact) {
    return (
      <div className="pt-1">
        <div className="space-y-3">{content}</div>
      </div>
    );
  }

  return (
    <DMSCard className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <DMSCardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)] px-6 pt-4 pb-3">
        <DMSCardTitle className="text-[15px] font-semibold text-[var(--text)]">Photos & Status</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent className="px-5 pt-6 pb-5 space-y-3">{content}</DMSCardContent>
    </DMSCard>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
