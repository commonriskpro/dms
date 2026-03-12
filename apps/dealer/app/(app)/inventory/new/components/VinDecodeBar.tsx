"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { modalDepthSurface, modalFieldTone } from "@/lib/ui/modal-depth";

export interface VinDecodeBarProps {
  vin: string;
  onVinChange: (value: string) => void;
  onDecode: () => void;
  onScan?: () => void;
  decodeLoading?: boolean;
  error?: string | null;
  /** When true, VIN input receives focus on mount (e.g. in modal). */
  autoFocus?: boolean;
  /** When true, bar is rendered in modal header (no bottom border, compact). */
  inHeader?: boolean;
}

export function VinDecodeBar({
  vin,
  onVinChange,
  onDecode,
  onScan,
  decodeLoading = false,
  error,
  autoFocus = false,
  inHeader = false,
}: VinDecodeBarProps) {
  return (
    <div
      className={
        inHeader
          ? "flex min-w-0 flex-1 items-center justify-center"
          : `${modalDepthSurface} px-4 py-4`
      }
    >
      {!inHeader && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">VIN intake</div>
            <p className="mt-1 text-sm text-[var(--muted-text)]">
              Start with the VIN to auto-fill the unit identity before manual edits.
            </p>
          </div>
        </div>
      )}
      <div className={inHeader ? "flex min-w-0 flex-1 items-center justify-center gap-3" : "flex flex-wrap items-center gap-3"}>
        <div className={inHeader ? "min-w-0 flex-1 max-w-[520px]" : "w-full min-w-0 sm:w-[520px]"}>
          <Input
            label={inHeader ? "" : undefined}
            placeholder="Enter VIN"
            value={vin}
            onChange={(e) => onVinChange(e.target.value.toUpperCase())}
            maxLength={17}
            error={error ?? undefined}
            className={`${modalFieldTone} h-10 w-full`}
            aria-label="VIN"
            autoFocus={autoFocus}
          />
        </div>
        <Button
          type="button"
          onClick={onDecode}
          disabled={decodeLoading || vin.trim().length < 8}
          className="h-10 shrink-0 whitespace-nowrap px-4"
        >
          {decodeLoading ? "Decoding…" : "Decode VIN"}
        </Button>
        {onScan && (
          <Button type="button" variant="secondary" onClick={onScan} className="h-10 shrink-0 px-4">
            <ScanIcon className="mr-2 h-4 w-4" />
            Scan VIN
          </Button>
        )}
      </div>
    </div>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <rect width="8" height="4" x="7" y="10" rx="1" />
      <rect width="8" height="4" x="9" y="14" rx="1" />
    </svg>
  );
}
