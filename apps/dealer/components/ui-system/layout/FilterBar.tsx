import * as React from "react";
import { cn } from "@/lib/utils";
import { layoutTokens } from "@/lib/ui/tokens";

export type FilterBarProps = React.HTMLAttributes<HTMLDivElement> & {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  viewControls?: React.ReactNode;
  actions?: React.ReactNode;
};

export function FilterBar({
  search,
  filters,
  viewControls,
  actions,
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div className={cn(layoutTokens.filterBar, className)} {...props}>
      {children ? (
        children
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {search}
            {filters}
            {viewControls}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </>
      )}
    </div>
  );
}
