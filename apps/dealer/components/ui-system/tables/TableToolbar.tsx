import * as React from "react";
import { cn } from "@/lib/utils";
import { tableTokens } from "@/lib/ui/tokens";

type TableToolbarProps = React.HTMLAttributes<HTMLDivElement> & {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
};

export function TableToolbar({
  search,
  filters,
  actions,
  children,
  className,
  ...props
}: TableToolbarProps) {
  return (
    <div className={cn(tableTokens.toolbar, className)} {...props}>
      {children ? (
        children
      ) : (
        <>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {search}
            {filters}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </>
      )}
    </div>
  );
}
