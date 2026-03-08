import * as React from "react";
import { Widget } from "@/components/ui-system/widgets";
import { EmptyStatePanel } from "@/components/ui-system/feedback";
import { SignalInlineList } from "./SignalInlineList";
import type { SignalSurfaceItem } from "./types";

export function SignalSummaryPanel({
  title = "Intelligence signals",
  subtitle,
  action,
  items,
  maxVisible,
  emptyTitle = "No active signals",
  emptyDescription = "Signals will appear here when conditions are triggered.",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  items: SignalSurfaceItem[];
  maxVisible?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  return (
    <Widget title={title} subtitle={subtitle} action={action}>
      {items.length === 0 ? (
        <EmptyStatePanel title={emptyTitle} description={emptyDescription} />
      ) : (
        <SignalInlineList items={items} maxVisible={maxVisible} />
      )}
    </Widget>
  );
}
