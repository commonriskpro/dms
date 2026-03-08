import * as React from "react";
import { cn } from "@/lib/utils";
import { tableTokens } from "@/lib/ui/tokens";

export function ColumnHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn(tableTokens.columnHeader, className)}>{children}</span>;
}
