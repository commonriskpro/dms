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
    <footer className="flex shrink-0 justify-end items-center gap-3 pt-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 pb-2">
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
    </footer>
  );
}
