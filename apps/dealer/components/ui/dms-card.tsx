import * as React from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DMSCardBase =
  "rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-150";
const DMSCardHeaderBase = "w-full flex flex-row items-center justify-start px-4 pt-4 pb-3";
const DMSCardTitleBase = "text-base font-semibold text-[var(--text)] text-left leading-tight";
const DMSCardContentBase = "px-4 pb-4 pt-0";

export function DMSCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={cn(DMSCardBase, className)} {...props} />
  );
}

export function DMSCardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(DMSCardHeaderBase, className)} {...props} />
  );
}

export function DMSCardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <CardTitle className={cn(DMSCardTitleBase, className)} {...props} />
  );
}

export function DMSCardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <CardContent className={cn(DMSCardContentBase, className)} {...props} />
  );
}
