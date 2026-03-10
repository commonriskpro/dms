import * as React from "react";
import { cn } from "@/lib/utils";
import { tableTokens } from "@/lib/ui/tokens";
import { ErrorStatePanel } from "@/components/ui-system/feedback/ErrorStatePanel";
import { EmptyStatePanel } from "@/components/ui-system/feedback/EmptyStatePanel";
import { LoadingSkeletonSet } from "@/components/ui-system/feedback/LoadingSkeletonSet";

type TableLayoutState = "default" | "loading" | "empty" | "error";

export type TableLayoutProps = {
  toolbar?: React.ReactNode;
  pagination?: React.ReactNode;
  state?: TableLayoutState;
  emptyTitle?: string;
  emptyDescription?: string;
  errorMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function TableLayout({
  toolbar,
  pagination,
  state = "default",
  emptyTitle = "No results",
  emptyDescription = "There is no data to display.",
  errorMessage,
  onRetry,
  children,
  className,
}: TableLayoutProps) {
  return (
    <section className={cn(tableTokens.shell, className)}>
      {toolbar}
      {state === "loading" ? (
        <div className="p-4">
          <LoadingSkeletonSet kind="table" />
        </div>
      ) : null}
      {state === "error" ? (
        <div className="p-4">
          <ErrorStatePanel title="Could not load table" description={errorMessage} onRetry={onRetry} />
        </div>
      ) : null}
      {state === "empty" ? (
        <div className="p-4">
          <EmptyStatePanel title={emptyTitle} description={emptyDescription} />
        </div>
      ) : null}
      {state === "default" ? children : null}
      {pagination ? <div className={tableTokens.footer}>{pagination}</div> : null}
    </section>
  );
}
