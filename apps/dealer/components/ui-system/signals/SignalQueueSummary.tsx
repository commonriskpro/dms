import * as React from "react";
import { QueueKpiStrip } from "@/components/ui-system/queues";
import type { SignalSurfaceItem } from "./types";

export function SignalQueueSummary({
  items,
  maxVisible = 4,
}: {
  items: SignalSurfaceItem[];
  maxVisible?: number;
}) {
  const visible = items.slice(0, maxVisible);
  if (visible.length === 0) return null;

  return (
    <QueueKpiStrip
      items={visible.map((item) => ({
        label: item.title,
        value:
          typeof item.count === "number" ? (
            item.count.toLocaleString()
          ) : (
            <span className="text-sm font-medium capitalize">{item.severity}</span>
          ),
        hint: item.description ?? undefined,
      }))}
      className="md:grid-cols-2 xl:grid-cols-4"
    />
  );
}
