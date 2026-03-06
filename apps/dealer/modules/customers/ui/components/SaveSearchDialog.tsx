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
import type { SavedSearchCatalogItem, SavedSearchState } from "@/lib/types/saved-filters-searches";

const VISIBILITY_OPTIONS: SelectOption[] = [
  { value: "PERSONAL", label: "Personal" },
  { value: "SHARED", label: "Shared" },
];

export type SaveSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full list view state to save. */
  state: SavedSearchState;
  /** When set, dialog is in "Update current" mode (PATCH). */
  existingSearchId: string | null;
  /** Pre-fill name when in update mode. */
  initialName?: string;
  onSuccess: () => void;
};

export function SaveSearchDialog({
  open,
  onOpenChange,
  state,
  existingSearchId,
  initialName,
  onSuccess,
}: SaveSearchDialogProps) {
  const { addToast } = useToast();
  const [name, setName] = React.useState("");
  const [visibility, setVisibility] = React.useState<"PERSONAL" | "SHARED">("PERSONAL");
  const [isDefault, setIsDefault] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const isUpdate = Boolean(existingSearchId);

  React.useEffect(() => {
    if (open) {
      setName(initialName ?? "");
      setVisibility("PERSONAL");
      setIsDefault(false);
    }
  }, [open, existingSearchId, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      if (isUpdate && existingSearchId) {
        await apiFetch<{ data: SavedSearchCatalogItem }>(
          `/api/customers/saved-searches/${existingSearchId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              name: trimmed,
              visibility,
              state,
              isDefault,
            }),
          }
        );
        addToast("success", "Saved search updated");
      } else {
        await apiFetch<{ data: { id: string } }>("/api/customers/saved-searches", {
          method: "POST",
          body: JSON.stringify({
            name: trimmed,
            visibility,
            state,
            isDefault,
          }),
        });
        addToast("success", "Saved search created");
      }
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
            <DialogTitle>{isUpdate ? "Update saved search" : "Save search"}</DialogTitle>
            <p className="text-sm text-[var(--text-soft)] mt-1">
              {isUpdate
                ? "Update this list view with the current filters, sort, and page size."
                : "Save the current list view (search, filters, sort, page size) so you can apply it later."}
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="save-search-name">Name</Label>
              <Input
                id="save-search-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My active leads"
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
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="save-search-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              <Label htmlFor="save-search-default" className="font-normal cursor-pointer">
                Set as default list view
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? (isUpdate ? "Updating…" : "Saving…") : isUpdate ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
