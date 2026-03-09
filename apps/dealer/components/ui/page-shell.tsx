import * as React from "react";
import {
  PageShell as SystemPageShell,
  PageHeader as SystemPageHeader,
} from "@/components/ui-system/layout";
import { ui } from "@/lib/ui/tokens";

/** Wraps a page: sets background and page padding using tokens. */
export function PageShell({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <SystemPageShell className={className} {...props}>
      {children}
    </SystemPageShell>
  );
}

/** Standard header layout: title left, actions right. Title and actions are optional. */
export function PageHeader({
  title,
  description,
  actions,
  className = "",
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  if (title == null && description == null && actions == null) return null;
  return (
    <SystemPageHeader
      title={title}
      description={description}
      actions={actions}
      className={className}
      {...props}
    />
  );
}

/** Wraps grids with consistent gap from tokens. */
export function SectionGrid({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`grid ${ui.grid} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
