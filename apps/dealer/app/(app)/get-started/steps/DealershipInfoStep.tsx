"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DealershipInfoStepProps = {
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  isLoading: boolean;
};

export function DealershipInfoStep({
  onNext,
  onSkip,
  isLoading,
}: DealershipInfoStepProps) {
  const { addToast } = useToast();
  const [name, setName] = React.useState("");
  const [loadingData, setLoadingData] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ dealership: { name: string }; locations: unknown[] }>("/api/admin/dealership")
      .then((data) => {
        if (!cancelled) {
          setName(data.dealership.name || "");
        }
      })
      .catch(() => {
        if (!cancelled) setName("");
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSaveAndContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      addToast("error", "Dealership name is required");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/admin/dealership", {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      addToast("success", "Saved");
      onNext();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return <p className="text-[var(--text-soft)]">Loading dealership info…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-soft)]">
        Confirm or set your dealership display name. You can add address and more details later in Settings.
      </p>
      <Input
        label="Dealership name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Main Street Auto"
      />
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          onClick={handleSaveAndContinue}
          disabled={isLoading || saving || !name.trim()}
          isLoading={saving}
        >
          Save and continue
        </Button>
      </div>
    </div>
  );
}
