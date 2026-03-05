"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, type SelectOption } from "@/components/ui/select";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import type { SavedFilterDefinition } from "@/lib/types/saved-filters-searches";

const VISIBILITY_OPTIONS: SelectOption[] = [
  { value: "PERSONAL", label: "Personal" },
  { value: "SHARED", label: "Shared" },
];

export type SaveFilterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current filter definition only (no q, sort, limit). */
  definition: SavedFilterDefinition;
  onSuccess: () => void;
};

export function SaveFilterDialog({
  open,
  onOpenChange,
  definition,
  onSuccess,
}: SaveFilterDialogProps) {
  const { addToast } = useToast();
  const [name, setName] = React.useState("");
  const [visibility, setVisibility] = React.useState<"PERSONAL" | "SHARED">("PERSONAL");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setVisibility("PERSONAL");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await apiFetch<{ data: { id: string } }>("/api/customers/saved-filters", {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          visibility,
          definition,
        }),
      });
      addToast("success", "Filter saved");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      addToast("error", getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save filter</DialogTitle>
            <p className="text-sm text-[var(--text-soft)] mt-1">
              Save the current filter rules (status, source, etc.) so you can apply them later. Search text and sort are not saved.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="save-filter-name">Name</Label>
              <Input
                id="save-filter-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Active leads"
                className="mt-1"
                maxLength={200}
                required
              />
            </div>
            <div>
              <Select
                label="Visibility"
                options={VISIBILITY_OPTIONS}
                value={visibility}
                onChange={(v) => setVisibility(v as "PERSONAL" | "SHARED")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
