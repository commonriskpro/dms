"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn("flex flex-wrap items-center gap-1.5 text-sm", className)}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 ? (
            <span className="text-[var(--muted-text)]/70" aria-hidden>
              /
            </span>
          ) : null}
          {item.href != null ? (
            <Link
              href={item.href}
              className="text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[var(--muted-text)]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
