"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface VinDecodeBarProps {
  vin: string;
  onVinChange: (value: string) => void;
  onDecode: () => void;
  onScan?: () => void;
  decodeLoading?: boolean;
  error?: string | null;
}

export function VinDecodeBar({
  vin,
  onVinChange,
  onDecode,
  onScan,
  decodeLoading = false,
  error,
}: VinDecodeBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
      <span className="text-sm font-medium text-[var(--text)]">VIN Decode</span>
      <Input
        label=""
        placeholder="Enter VIN"
        value={vin}
        onChange={(e) => onVinChange(e.target.value.toUpperCase())}
        maxLength={17}
        error={error ?? undefined}
        className="max-w-[220px]"
        aria-label="VIN"
      />
      <Button
        type="button"
        onClick={onDecode}
        disabled={decodeLoading || vin.trim().length < 8}
      >
        {decodeLoading ? "Decoding…" : "Decode VIN"}
      </Button>
      {onScan && (
        <Button type="button" variant="secondary" onClick={onScan} className="ml-auto">
          <ScanIcon className="mr-2 h-4 w-4" />
          Scan VIN
        </Button>
      )}
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
