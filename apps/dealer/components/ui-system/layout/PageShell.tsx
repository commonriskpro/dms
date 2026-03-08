import * as React from "react";
import { cn } from "@/lib/utils";
import { layoutTokens } from "@/lib/ui/tokens";

export type PageShellProps = React.HTMLAttributes<HTMLDivElement> & {
  rail?: React.ReactNode;
  fullWidth?: boolean;
  contentClassName?: string;
};

export function PageShell({
  className,
  rail,
  fullWidth = false,
  contentClassName,
  children,
  ...props
}: PageShellProps) {
  if (!rail) {
    return (
      <div className={cn(layoutTokens.pageShell, className)} {...props}>
        <div className={cn(layoutTokens.pageStack, !fullWidth && "mx-[2px]", contentClassName)}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(layoutTokens.pageShell, className)} {...props}>
      <div
        className={cn(
          "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]",
          !fullWidth && "mx-[2px]",
          contentClassName
        )}
      >
        <div className={layoutTokens.pageStack}>{children}</div>
        <aside className="hidden lg:block">{rail}</aside>
      </div>
    </div>
  );
}
