"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DMSRowBase =
  "w-full text-left min-h-[44px] flex items-center justify-between rounded-[12px] px-2 -mx-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const DMSRowHover = "hover:bg-[var(--surface-2)]/60";
const DMSRowLeftBase = "flex items-center gap-3 min-w-0";
const DMSRowRightBase = "flex items-center gap-2 shrink-0 text-xs text-[var(--muted-text)]";

export interface DMSRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  left: React.ReactNode;
  right: React.ReactNode;
  asLink?: boolean;
  href?: string;
}

/** Standardized plain row: left badge + label, right meta. No background by default. */
export function DMSRow({
  left,
  right,
  className,
  asLink,
  href,
  children,
  ...props
}: DMSRowProps) {
  const content = (
    <>
      <span className={DMSRowLeftBase}>{left}</span>
      <span className={DMSRowRightBase}>
        {right}
        <span className="opacity-0 group-hover:opacity-100 transition" aria-hidden>→</span>
      </span>
    </>
  );
  const classes = cn(DMSRowBase, DMSRowHover, "group", className);
  if (asLink && href) {
    return (
      <a href={href} className={cn(classes, "block no-underline")} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...props}>
      {content}
    </button>
  );
}

const DMSBadgeBase =
  "inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]";

export function DMSBadge({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn(DMSBadgeBase, className)} {...props}>
      {children}
    </span>
  );
}
