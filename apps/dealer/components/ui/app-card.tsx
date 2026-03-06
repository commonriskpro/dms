"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { warnIfForbiddenClasses } from "@/lib/ui/style-policy";

const APP_CARD_BASE =
  "rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card-stack)] transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]";

const APP_CARD_CONTENT_PADDING = "px-4 pb-4 pt-5";

export interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Content area padding matches dashboard (top breathing room like MetricCard). */
  contentClassName?: string;
}

export function AppCard({ className = "", children, ...props }: AppCardProps) {
  const merged = `${APP_CARD_BASE} ${className}`.trim();
  React.useEffect(() => {
    warnIfForbiddenClasses("AppCard", merged);
  }, [merged]);
  return (
    <Card className={merged} {...props}>
      {children}
    </Card>
  );
}

export function AppCardContent({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const merged = `${APP_CARD_CONTENT_PADDING} ${className}`.trim();
  return (
    <CardContent className={merged} {...props}>
      {children}
    </CardContent>
  );
}

export function AppCardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <CardHeader className={`mb-3 ${className}`.trim()} {...props}>
      {children}
    </CardHeader>
  );
}

export function AppCardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <CardTitle
      className={`text-sm font-semibold text-[var(--text)] ${className}`.trim()}
      {...props}
    >
      {children}
    </CardTitle>
  );
}

export function AppCardFooter({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <CardFooter className={`pt-0 ${className}`.trim()} {...props} />;
}
