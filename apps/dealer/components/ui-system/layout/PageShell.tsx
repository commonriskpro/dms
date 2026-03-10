import * as React from "react";
import { cn } from "@/lib/utils";
import { layoutTokens } from "@/lib/ui/tokens";

type PageShellProps = React.HTMLAttributes<HTMLDivElement> & {
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
  const widthConstraint = !fullWidth && "max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8";

  if (!rail) {
    return (
      <div className={cn(layoutTokens.pageShell, className)} {...props}>
        <div className={cn(layoutTokens.pageStack, widthConstraint, contentClassName)}>
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
          widthConstraint,
          contentClassName
        )}
      >
        <div className={layoutTokens.pageStack}>{children}</div>
        <aside className="hidden lg:block">{rail}</aside>
      </div>
    </div>
  );
}
