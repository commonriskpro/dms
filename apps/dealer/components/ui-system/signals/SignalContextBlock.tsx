import * as React from "react";
import { SignalSummaryPanel } from "./SignalSummaryPanel";
import type { SignalSurfaceItem } from "./types";

export function SignalContextBlock({
  title = "Context signals",
  items,
  maxVisible = 5,
}: {
  title?: React.ReactNode;
  items: SignalSurfaceItem[];
  maxVisible?: number;
}) {
  return (
    <SignalSummaryPanel
      title={title}
      subtitle="Prioritized by severity and recency"
      items={items}
      maxVisible={maxVisible}
      emptyTitle="No context signals"
      emptyDescription="No unresolved signals for this context."
    />
  );
}
