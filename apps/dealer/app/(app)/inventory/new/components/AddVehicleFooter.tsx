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
}

export function AddVehicleFooter({
  onCancel,
  onSaveDraft,
  onSaveAndAddAnother,
  onCreateVehicle,
  createLoading = false,
  saveDraftDisabled = false,
  createDisabled = false,
}: AddVehicleFooterProps) {
  return (
    <footer className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={onSaveDraft}
        disabled={saveDraftDisabled}
      >
        Save Draft
      </Button>
      <Button
        type="button"
        onClick={onSaveAndAddAnother}
        disabled={createLoading || createDisabled}
      >
        {createLoading ? "Saving…" : "Save & Add Another"}
      </Button>
      <Button
        type="button"
        onClick={onCreateVehicle}
        disabled={createLoading || createDisabled}
      >
        {createLoading ? "Creating…" : "Create Vehicle"}
      </Button>
    </footer>
  );
}
