import * as React from "react";
import { cn } from "@/lib/utils";

const DMSPageBase = "px-6 py-6 bg-[var(--page-bg)] min-h-full";
const DMSSectionBase = "space-y-4";

export function DMSPage({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(DMSPageBase, className)} {...props}>
      {children}
    </div>
  );
}

export function DMSSection({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(DMSSectionBase, className)} {...props}>
      {children}
    </div>
  );
}
