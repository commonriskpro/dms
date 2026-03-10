import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  if (!title && !description && !actions && !breadcrumbs && !meta) return null;

  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {breadcrumbs ? <div>{breadcrumbs}</div> : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          {title ? <div className="text-[28px] font-semibold leading-tight text-[var(--text)]">{title}</div> : null}
          {description ? <div className="text-sm text-[var(--muted-text)]">{description}</div> : null}
          {meta ? <div>{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
