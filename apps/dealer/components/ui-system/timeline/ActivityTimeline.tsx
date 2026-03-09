import * as React from "react";
import { EmptyStatePanel } from "@/components/ui-system/feedback";

export function ActivityTimeline({
  title = "Activity timeline",
  children,
  emptyTitle = "No activity yet",
  emptyDescription = "Updates will appear here as work progresses.",
}: {
  title?: string;
  children: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const hasChildren = React.Children.count(children) > 0;

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--text)]">{title}</h4>
      {!hasChildren ? (
        <EmptyStatePanel title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}
