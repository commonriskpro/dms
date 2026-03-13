"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CustomerListItem } from "@/lib/types/customers";
import { customerDetailPath, customerDraftPath } from "@/lib/routes/detail-paths";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    LEAD: "Prospect",
    ACTIVE: "Active",
    SOLD: "Sold",
    INACTIVE: "Archived",
  };
  return map[s] ?? s;
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "ACTIVE":
      return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
    case "LEAD":
      return "bg-sky-500/15 text-sky-400 border border-sky-500/30";
    case "SOLD":
      return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
    case "INACTIVE":
      return "bg-[var(--surface-2)] text-[var(--muted-text)] border border-[var(--border)]";
    default:
      return "bg-[var(--surface-2)] text-[var(--muted-text)] border border-[var(--border)]";
  }
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffDay = Math.floor(diffMs / 86_400_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDay === 1) return "1 day ago";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type CustomerCardGridProps = {
  items: CustomerListItem[];
  canWrite: boolean;
};

export function CustomerCardGrid({ items, canWrite }: CustomerCardGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted-text)] shadow-[var(--shadow-card)]">
        No customers match the current filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((c) => {
        const detailHref = c.isDraft ? customerDraftPath(c.id) : customerDetailPath(c.id);
        return (
          <div
            key={c.id}
            className="surface-noise flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--accent)]/40"
          >
            <div className="flex items-start gap-3 px-4 pt-4 pb-2">
              <div
                className="h-11 w-11 shrink-0 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm font-semibold text-[var(--text)]"
                aria-hidden
              >
                {getInitials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text)] truncate leading-tight">{c.name}</span>
                  {c.isDraft && (
                    <span className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                      Draft
                    </span>
                  )}
                  <span className={`inline-flex shrink-0 items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(c.status)}`}>
                    {statusLabel(c.status)}
                  </span>
                </div>
                {c.primaryEmail && (
                  <p className="text-xs text-[var(--muted-text)] truncate leading-snug mt-0.5">{c.primaryEmail}</p>
                )}
                {c.primaryPhone && (
                  <p className="text-xs text-[var(--muted-text)] truncate leading-snug">{c.primaryPhone}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5">
              {c.leadSource && (
                <span className="rounded-[var(--radius-pill)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-text)] border border-[var(--border)]">
                  {c.leadSource}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-[var(--muted-text)]">
              {c.assignedToProfile?.fullName && (
                <>
                  <span className="font-medium text-[var(--text)]">{c.assignedToProfile.fullName}</span>
                  <span className="opacity-40">·</span>
                </>
              )}
              {c.lastVisitAt ? (
                <span>{formatRelativeTime(c.lastVisitAt)}</span>
              ) : (
                <span>No contact</span>
              )}
            </div>

            <div
              className="flex items-center gap-1.5 border-t border-[var(--border)] px-4 py-2.5 mt-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={detailHref} className="flex-1">
                <Button variant="secondary" size="sm" className="w-full text-xs">
                  {c.isDraft ? "Resume" : "View"}
                </Button>
              </Link>
              {canWrite && (
                <Link href={detailHref} className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full text-xs">
                    {c.isDraft ? "Edit Draft" : "Edit"}
                  </Button>
                </Link>
              )}
              <Link
                href={detailHref}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-button)] border border-[var(--border)] text-[var(--muted-text)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                aria-label={`View ${c.name}`}
              >
                ›
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
