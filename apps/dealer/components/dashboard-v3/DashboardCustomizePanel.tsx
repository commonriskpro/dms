"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DashboardLayoutItem } from "./types";
import { Sheet, SheetHeader, SheetTitle, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ChevronUp, ChevronDown } from "@/lib/ui/icons";
import { typography } from "@/lib/ui/tokens";

type DashboardCustomizePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: DashboardLayoutItem[];
};

function buildPayload(draft: DashboardLayoutItem[]): { version: 1; widgets: Array<{ widgetId: string; visible: boolean; zone: "topRow" | "main"; order: number }> } {
  const topRow = draft.filter((w) => w.zone === "topRow").sort((a, b) => a.order - b.order);
  const main = draft.filter((w) => w.zone === "main").sort((a, b) => a.order - b.order);
  const widgets = [
    ...topRow.map((w, i) => ({ widgetId: w.widgetId, visible: w.visible, zone: "topRow" as const, order: i })),
    ...main.map((w, i) => ({ widgetId: w.widgetId, visible: w.visible, zone: "main" as const, order: i })),
  ];
  return { version: 1, widgets };
}

export function DashboardCustomizePanel({ open, onOpenChange, layout }: DashboardCustomizePanelProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<DashboardLayoutItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const { addToast } = useToast();
  const confirm = useConfirm();

  React.useEffect(() => {
    if (open && layout.length > 0) {
      setDraft([...layout]);
    }
  }, [open, layout]);

  const move = (widgetId: string, direction: "up" | "down") => {
    setDraft((prev) => {
      const item = prev.find((w) => w.widgetId === widgetId);
      if (!item) return prev;
      const inZone = prev.filter((w) => w.zone === item.zone).sort((a, b) => a.order - b.order);
      const idx = inZone.findIndex((w) => w.widgetId === widgetId);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? Math.max(0, idx - 1) : Math.min(inZone.length - 1, idx + 1);
      if (newIdx === idx) return prev;
      const reordered = [...inZone];
      const [removed] = reordered.splice(idx, 1);
      reordered.splice(newIdx, 0, removed);
      const withNewOrder = reordered.map((w, i) => ({ ...w, order: i }));
      const otherZone = prev.filter((w) => w.zone !== item.zone);
      return [...otherZone, ...withNewOrder];
    });
  };

  const setVisible = (widgetId: string, visible: boolean) => {
    setDraft((prev) => prev.map((w) => (w.widgetId === widgetId ? { ...w, visible } : w)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload(draft);
      const res = await fetch("/api/dashboard/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = data?.error?.code;
        const message = data?.error?.message ?? "";
        if (res.status === 429) {
          addToast("error", "Too many requests. Try again in a minute.");
        } else if (code === "VALIDATION_ERROR" && message.toLowerCase().includes("too large")) {
          addToast("error", "Layout too large. Remove some widgets and try again.");
        } else {
          addToast("error", message || "Failed to save layout");
        }
        return;
      }
      addToast("success", "Dashboard layout saved");
      onOpenChange(false);
      router.refresh();
    } catch {
      addToast("error", "Failed to save layout");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: "Reset to default?",
      description: "Your custom layout will be removed and the default dashboard layout will be restored.",
      confirmText: "Reset",
      cancelText: "Cancel",
      variant: "default",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/layout/reset", { method: "POST" });
      if (!res.ok) {
        if (res.status === 429) {
          addToast("error", "Too many requests. Try again in a minute.");
        } else {
          addToast("error", "Failed to reset layout");
        }
        return;
      }
      addToast("success", "Dashboard reset to default");
      onOpenChange(false);
      router.refresh();
    } catch {
      addToast("error", "Failed to reset layout");
    } finally {
      setSaving(false);
    }
  };

  const topRowItems = draft.filter((w) => w.zone === "topRow").sort((a, b) => a.order - b.order);
  const mainItems = draft.filter((w) => w.zone === "main").sort((a, b) => a.order - b.order);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetHeader>
        <SheetTitle>Customize dashboard</SheetTitle>
      </SheetHeader>
      <SheetContent className="flex flex-col">
        <p className="text-sm text-[var(--muted-text)] mb-4">
          Show or hide widgets and change their order. Changes are saved only when you click Save.
        </p>
        <div className="space-y-6 flex-1 overflow-y-auto">
          {topRowItems.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-[var(--text)] mb-2">Metric row</h3>
              <ul className="space-y-2">
                {topRowItems.map((item, i) => (
                  <li
                    key={item.widgetId}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-[var(--text)]">{item.title}</span>
                      {item.description && (
                        <span className="text-xs text-[var(--muted-text)] mt-0.5">{item.description}</span>
                      )}
                    </div>
                    {!item.fixed && (
                      <Switch
                        checked={item.visible}
                        onCheckedChange={(v) => setVisible(item.widgetId, v)}
                        aria-label={`Show ${item.title}`}
                      />
                    )}
                    {item.fixed && (
                      <span className="text-xs text-[var(--muted-text)]">Always visible</span>
                    )}
                    <div className="flex flex-col gap-0">
                      <button
                        type="button"
                        onClick={() => move(item.widgetId, "up")}
                        disabled={i === 0}
                        className="p-1 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--muted)] disabled:opacity-50 disabled:pointer-events-none"
                        aria-label={`Move ${item.title} up`}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(item.widgetId, "down")}
                        disabled={i === topRowItems.length - 1}
                        className="p-1 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--muted)] disabled:opacity-50 disabled:pointer-events-none"
                        aria-label={`Move ${item.title} down`}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {mainItems.length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-[var(--text)] mb-2">Widgets</h3>
              <ul className="space-y-2">
                {mainItems.map((item, i) => (
                  <li
                    key={item.widgetId}
                    className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-[var(--text)]">{item.title}</span>
                      {item.description && (
                        <span className="text-xs text-[var(--muted-text)] mt-0.5">{item.description}</span>
                      )}
                    </div>
                    {!item.fixed && (
                      <Switch
                        checked={item.visible}
                        onCheckedChange={(v) => setVisible(item.widgetId, v)}
                        aria-label={`Show ${item.title}`}
                      />
                    )}
                    {item.fixed && (
                      <span className="text-xs text-[var(--muted-text)]">Always visible</span>
                    )}
                    <div className="flex flex-col gap-0">
                      <button
                        type="button"
                        onClick={() => move(item.widgetId, "up")}
                        disabled={i === 0}
                        className="p-1 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--muted)] disabled:opacity-50 disabled:pointer-events-none"
                        aria-label={`Move ${item.title} up`}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(item.widgetId, "down")}
                        disabled={i === mainItems.length - 1}
                        className="p-1 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--muted)] disabled:opacity-50 disabled:pointer-events-none"
                        aria-label={`Move ${item.title} down`}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border)] mt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
            className="border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            Reset to default
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
