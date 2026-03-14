import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Render title as h1 (default) for main page title, or "div" for nested layouts */
  titleAs?: "h1" | "div";
  className?: string;
};

const titleClasses = "text-[28px] font-semibold leading-tight text-[var(--text)]";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  meta,
  actions,
  titleAs = "h1",
  className,
}: PageHeaderProps) {
  if (!title && !description && !actions && !breadcrumbs && !meta) return null;

  const TitleTag = titleAs;

  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {breadcrumbs ? <div>{breadcrumbs}</div> : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          {title ? <TitleTag className={titleClasses}>{title}</TitleTag> : null}
          {description ? <div className="text-sm text-[var(--muted-text)]">{description}</div> : null}
          {meta ? <div>{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
