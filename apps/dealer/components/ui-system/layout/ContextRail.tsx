import * as React from "react";
import { cn } from "@/lib/utils";
import { layoutTokens } from "@/lib/ui/tokens";

export type ContextRailProps = React.HTMLAttributes<HTMLDivElement> & {
  sticky?: boolean;
};

export function ContextRail({
  className,
  sticky = true,
  children,
  ...props
}: ContextRailProps) {
  return (
    <div className={cn(layoutTokens.contextRail, sticky && "sticky top-4", className)} {...props}>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
