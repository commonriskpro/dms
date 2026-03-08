import * as React from "react";
import { PageHeader } from "@/components/ui-system/layout";
import { cn } from "@/lib/utils";

export type EntityMetaItem = {
  label: string;
  value: React.ReactNode;
};

export function EntityHeader({
  title,
  subtitle,
  status,
  actions,
  breadcrumbs,
  meta = [],
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  meta?: EntityMetaItem[];
  className?: string;
}) {
  const description =
    !subtitle && meta.length === 0 ? undefined : (
      <div className="space-y-2">
        {subtitle ? <p>{subtitle}</p> : null}
        {meta.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-text)]">
            {meta.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1">
                <span className="font-medium text-[var(--text-soft)]">{item.label}:</span>
                <span>{item.value}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );

  return (
    <div className={cn("space-y-2", className)}>
      {breadcrumbs ? <div>{breadcrumbs}</div> : null}
      <PageHeader
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>{title}</span>
            {status}
          </div>
        }
        description={description}
        actions={actions}
      />
    </div>
  );
}
