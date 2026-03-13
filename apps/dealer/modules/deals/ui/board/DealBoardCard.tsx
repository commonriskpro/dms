"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money";
import type { BoardDealCard } from "@/modules/deals/service/board";
import { getDealQueueHref, getDealWorkspaceHref } from "../deal-workspace-href";
import {
  Search,
  MessageSquare,
  LayoutGrid,
  Landmark,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
} from "lucide-react";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function vehicleLabel(card: BoardDealCard): string {
  const parts: string[] = [];
  if (card.vehicleYear) parts.push(String(card.vehicleYear));
  if (card.vehicleMake) parts.push(card.vehicleMake);
  if (card.vehicleModel) parts.push(card.vehicleModel);
  return parts.join(" ") || "No vehicle";
}

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  DRAFT: { label: "Draft", cls: "border-[var(--border)] text-[var(--muted-text)]", icon: Clock },
  STRUCTURED: { label: "Structured", cls: "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]", icon: LayoutGrid },
  APPROVED: { label: "Approved", cls: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]", icon: CheckCircle2 },
  CONTRACTED: { label: "Contracted", cls: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]", icon: FileCheck },
};

const FUNDING_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]" },
  APPROVED: { label: "Approved", cls: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]" },
  FUNDED: { label: "Funded", cls: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]" },
  FAILED: { label: "Failed", cls: "border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]" },
};

const TITLE_BADGE: Record<string, { label: string; cls: string }> = {
  TITLE_PENDING: { label: "Title Pending", cls: "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]" },
  TITLE_SENT: { label: "Title Sent", cls: "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]" },
  TITLE_RECEIVED: { label: "Title Received", cls: "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]" },
  ISSUE_HOLD: { label: "Issue / Hold", cls: "border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]" },
};

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)]">
      {initials || "?"}
    </span>
  );
}

export type DealBoardCardProps = {
  card: BoardDealCard;
  columnId: string;
};

export function DealBoardCard({ card, columnId }: DealBoardCardProps) {
  const badge = STATUS_BADGE[card.status];
  const fundBadge = card.fundingStatus ? FUNDING_BADGE[card.fundingStatus] : null;
  const titleBadge = card.titleStatus ? TITLE_BADGE[card.titleStatus] : null;
  const BadgeIcon = badge?.icon ?? Clock;
  const modeBadge =
    card.financingMode === "CASH"
      ? {
          label: "Cash",
          cls: "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-soft)]",
        }
      : {
          label: "Finance",
          cls: "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]",
        };

  const href =
    columnId === "delivery"
      ? getDealQueueHref(card.id, "delivery-funding")
      : columnId === "funding"
        ? getDealQueueHref(card.id, "delivery-funding")
        : columnId === "title"
          ? getDealQueueHref(card.id, "title-dmv")
          : card.financingMode === "FINANCE"
            ? getDealWorkspaceHref(card.id, "finance")
            : getDealWorkspaceHref(card.id);

  return (
    <Link
      href={href}
      className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] transition-all hover:border-[var(--accent)]/40 hover:shadow-md"
    >
      {/* Top row: action icons + column total */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[var(--muted-text)]">
          {columnId === "desk" && (
            <>
              <LayoutGrid className="h-3.5 w-3.5" />
              <Search className="h-3.5 w-3.5" />
              <MessageSquare className="h-3.5 w-3.5" />
            </>
          )}
          {columnId === "delivery" && <Truck className="h-3.5 w-3.5" />}
          {columnId === "funding" && <Landmark className="h-3.5 w-3.5" />}
          {columnId === "title" && <FileCheck className="h-3.5 w-3.5" />}
        </div>
        <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
          {formatCents(card.totalDueCents)}
        </span>
      </div>

      {/* Customer row */}
      <div className="mb-2 flex items-center gap-2.5">
        <InitialsAvatar name={card.customerName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">
            {card.customerName}
          </p>
          <p className="truncate text-xs text-[var(--muted-text)]">
            {vehicleLabel(card)}
          </p>
        </div>
      </div>

      {/* Lender + status */}
      {card.lenderName && (
        <div className="mb-2 flex items-center gap-1.5">
          <Landmark className="h-3 w-3 shrink-0 text-[var(--muted-text)]" />
          <span className="truncate text-xs text-[var(--muted-text)]">{card.lenderName}</span>
          {card.financeStatus === "ACCEPTED" || card.financeStatus === "CONTRACTED" ? (
            <span className="ml-auto inline-flex items-center gap-0.5 rounded-full border border-[var(--success)]/30 bg-[var(--success)]/10 px-1.5 py-px text-[10px] font-medium text-[var(--success)]">
              approval
            </span>
          ) : null}
        </div>
      )}

      {/* Stock # + sale price row */}
      <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted-text)]">
        <span>#{card.stockNumber}</span>
        <span className="font-medium tabular-nums text-[var(--text)]">
          {formatCents(card.salePriceCents)}
        </span>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1">
        {badge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              badge.cls
            )}
          >
            <BadgeIcon className="h-3 w-3 shrink-0" />
            {badge.label}
          </span>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            modeBadge.cls
          )}
        >
          {modeBadge.label}
        </span>
        {fundBadge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              fundBadge.cls
            )}
          >
            {fundBadge.label}
          </span>
        )}
        {titleBadge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              titleBadge.cls
            )}
          >
            {titleBadge.label}
          </span>
        )}
        {card.deliveryStatus === "READY_FOR_DELIVERY" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
            Docs ready
          </span>
        )}
      </div>

      {/* Footer: updated time */}
      <div className="mt-2 flex items-center justify-between border-t border-[var(--border)]/50 pt-2">
        <span className="text-[10px] text-[var(--text-soft)]">
          Updated {timeAgo(card.updatedAt)}
        </span>
        <span className="text-xs font-semibold tabular-nums text-[var(--text)]">
          {formatCents(card.frontGrossCents)}
        </span>
      </div>
    </Link>
  );
}
