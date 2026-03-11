"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

export interface AddVehicleFooterProps {
  onCancel: () => void;
  onSaveDraft: () => void;
  onSaveAndAddAnother: () => void;
  onCreateVehicle: () => void;
  createLoading?: boolean;
  saveDraftDisabled?: boolean;
  createDisabled?: boolean;
  summary?: string;
  metrics?: Array<{
    label: string;
    value: string;
  }>;
}

export function AddVehicleFooter({
  onCancel,
  onSaveDraft,
  onSaveAndAddAnother,
  onCreateVehicle,
  createLoading = false,
  saveDraftDisabled = false,
  createDisabled = false,
  summary,
  metrics = [],
}: AddVehicleFooterProps) {
  return (
    <footer className="sticky bottom-0 z-10 shrink-0 rounded-[22px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--muted-text)]">
            {summary ?? "Complete the core fields, then create the vehicle record."}
          </p>
          {metrics.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-1 text-xs text-[var(--muted-text)]"
                >
                  <span className="font-medium text-[var(--text)]">{metric.value}</span>{" "}
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={saveDraftDisabled}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onSaveAndAddAnother}
            disabled={createLoading || createDisabled}
          >
            {createLoading ? "Saving…" : "Save & Add Another"}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onCreateVehicle}
            disabled={createLoading || createDisabled}
          >
            {createLoading ? "Creating…" : "Create Vehicle"}
          </Button>
        </div>
      </div>
    </footer>
  );
}
