import * as React from "react";
import { cn } from "@/lib/utils";
import { layoutTokens } from "@/lib/ui/tokens";
import { PageShell } from "./PageShell";
import { PageHeader } from "./PageHeader";

export type WorkspacePageLayoutProps = {
  /** Page title (rendered in header). */
  title?: React.ReactNode;
  /** Optional description below title. */
  description?: React.ReactNode;
  /** Optional breadcrumbs. */
  breadcrumbs?: React.ReactNode;
  /** Optional meta (counts, status chips). */
  meta?: React.ReactNode;
  /** Primary/secondary actions in header. */
  actions?: React.ReactNode;
  /** Optional KPI/summary strip below header. */
  summaryStrip?: React.ReactNode;
  /** Optional quick actions row (e.g. Add vehicle, New deal). */
  quickActions?: React.ReactNode;
  /** Optional quick filters / FilterBar row. */
  quickFilters?: React.ReactNode;
  /** Main workspace canvas content. */
  children: React.ReactNode;
  /** Optional right context rail (exceptions, next actions). */
  rail?: React.ReactNode;
  fullWidth?: boolean;
  contentClassName?: string;
  className?: string;
};

/**
 * Shared workspace page pattern: header, summary strip, quick actions, quick filters, main canvas, optional context rail.
 * Use for Sales, Inventory, Manager, Admin and future workspaces so all follow the same shell rules.
 */
export function WorkspacePageLayout({
  title,
  description,
  breadcrumbs,
  meta,
  actions,
  summaryStrip,
  quickActions,
  quickFilters,
  children,
  rail,
  fullWidth = false,
  contentClassName,
  className,
}: WorkspacePageLayoutProps) {
  const hasHeader = title != null || description != null || actions != null || breadcrumbs != null || meta != null;

  return (
    <PageShell rail={rail} fullWidth={fullWidth} contentClassName={contentClassName} className={className}>
      <div className={cn(layoutTokens.pageStack, "gap-4")}>
        {hasHeader ? (
          <PageHeader
            title={title}
            description={description}
            breadcrumbs={breadcrumbs}
            meta={meta}
            actions={actions}
          />
        ) : null}
        {summaryStrip ? (
          <div className={layoutTokens.sectionGapSm} data-workspace="summary-strip">
            {summaryStrip}
          </div>
        ) : null}
        {quickActions ? (
          <div className="flex flex-wrap items-center gap-2" data-workspace="quick-actions">
            {quickActions}
          </div>
        ) : null}
        {quickFilters ? (
          <div className={layoutTokens.filterBar} data-workspace="quick-filters">
            {quickFilters}
          </div>
        ) : null}
        <div data-workspace="canvas">{children}</div>
      </div>
    </PageShell>
  );
}
