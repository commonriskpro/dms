import * as React from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cardBase, cardHeaderBase, cardTitleBase, cardContentBase } from "@/lib/ui/recipes/card";

const DMSCardBase = cardBase;
const DMSCardHeaderBase = cardHeaderBase;
const DMSCardTitleBase = cardTitleBase;
const DMSCardContentBase = cardContentBase;

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
