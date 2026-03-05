import * as React from "react";
import { ui } from "@/lib/ui/tokens";

/** Wraps a page: sets background and page padding using tokens. */
export function PageShell({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`min-h-full bg-[var(--page-bg)] ${ui.page} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

/** Standard header layout: title left, actions right. */
export function PageHeader({
  title,
  actions,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between ${className}`.trim()}
      {...props}
    >
      <div className="min-w-0">{title}</div>
      {actions != null ? <div className="flex items-center gap-3 shrink-0">{actions}</div> : null}
    </div>
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
