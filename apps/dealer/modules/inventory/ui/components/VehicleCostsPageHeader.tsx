"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "@/lib/ui/icons";
import { StatusBadge } from "@/components/ui-system/tables";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client/http";
import { formatCents } from "@/lib/money";

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  AVAILABLE: "success",
  HOLD: "warning",
  SOLD: "neutral",
  WHOLESALE: "info",
  REPAIR: "warning",
  ARCHIVED: "danger",
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function printCostLedger(vehicleId: string, vehicleTitle: string, vin: string | null) {
  Promise.all([
    apiFetch<{ data: { acquisitionSubtotalCents: string; reconSubtotalCents: string; feesSubtotalCents: string; totalInvestedCents: string } }>(`/api/inventory/${vehicleId}/cost`),
    apiFetch<{ data: Array<{ category: string; amountCents: string; vendorName: string | null; occurredAt: string; memo: string | null }> }>(`/api/inventory/${vehicleId}/cost-entries`),
  ])
    .then(([costRes, entriesRes]) => {
      const cost = costRes.data;
      const entries = entriesRes.data;
      const rows = entries
        .map(
          (e) =>
            `<tr>
              <td style="padding:6px 12px;border-bottom:1px solid #ddd">${escapeHtml(new Date(e.occurredAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }))}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #ddd">${escapeHtml(e.category.replace(/_/g, " "))}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #ddd">${escapeHtml(e.vendorName ?? "—")}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #ddd;text-align:right;font-variant-numeric:tabular-nums">${escapeHtml(formatCents(e.amountCents))}</td>
              <td style="padding:6px 12px;border-bottom:1px solid #ddd">${escapeHtml(e.memo ?? "—")}</td>
            </tr>`,
        )
        .join("");

      const html = `<!DOCTYPE html><html><head><title>Cost Ledger — ${escapeHtml(vehicleTitle)}</title>
        <style>body{font-family:system-ui,sans-serif;padding:40px;color:#111}table{width:100%;border-collapse:collapse}th{text-align:left;padding:8px 12px;border-bottom:2px solid #333;font-size:12px;text-transform:uppercase;letter-spacing:0.05em}td{font-size:13px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 20px;color:#666;font-size:13px}.totals{display:flex;gap:32px;margin-bottom:24px}.tot{font-size:13px}.tot strong{display:block;font-size:16px;margin-top:2px}@media print{body{padding:20px}}</style>
      </head><body>
        <h1>${escapeHtml(vehicleTitle)}</h1>
        <p>${vin ? `VIN: ${escapeHtml(vin)}` : ""}</p>
        <div class="totals">
          <div class="tot">Acquisition<strong>${escapeHtml(formatCents(cost.acquisitionSubtotalCents))}</strong></div>
          <div class="tot">Recon<strong>${escapeHtml(formatCents(cost.reconSubtotalCents))}</strong></div>
          <div class="tot">Fees<strong>${escapeHtml(formatCents(cost.feesSubtotalCents))}</strong></div>
          <div class="tot">Total Invested<strong>${escapeHtml(formatCents(cost.totalInvestedCents))}</strong></div>
        </div>
        <table>
          <thead><tr>
            <th>Date</th><th>Category</th><th>Vendor</th><th style="text-align:right">Amount</th><th>Memo</th>
          </tr></thead>
          <tbody>${rows.length > 0 ? rows : '<tr><td colspan="5" style="padding:16px;text-align:center;color:#999">No cost entries</td></tr>'}</tbody>
        </table>
      </body></html>`;

      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
      }
    })
    .catch(() => {
      window.alert("Failed to load cost data for printing.");
    });
}

export type VehicleCostsPageHeaderProps = {
  vehicleId: string;
  title: string;
  vin: string | null;
  status: string | null;
  /** Optional thumbnail URL (e.g. first vehicle photo signed URL). */
  thumbnailUrl?: string | null;
  canWrite?: boolean;
  className?: string;
};

/**
 * Full-page Costs header: back link, thumbnail, vehicle name, VIN, status chip,
 * actions (Print, Edit, Edit Vehicle), then tab row with Costs active.
 * Matches mock: top part down to topbar with same margins and font hierarchy.
 */
export function VehicleCostsPageHeader({
  vehicleId,
  title,
  vin,
  status,
  thumbnailUrl,
  canWrite = false,
  className,
}: VehicleCostsPageHeaderProps) {
  return (
    <header
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]",
        "px-4 py-4 sm:px-6 sm:py-5",
        "space-y-4",
        className
      )}
    >
      {/* Row: back + thumbnail + title/vin/status + actions */}
      <div className="flex flex-wrap items-start gap-3 sm:gap-4">
        <Link
          href="/inventory"
          className="flex items-center gap-1 text-sm font-medium text-[var(--text-soft)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[var(--radius-button)] mt-0.5"
          aria-label="Back to inventory"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Back</span>
        </Link>

        <div
          className="h-12 w-16 sm:h-14 sm:w-20 shrink-0 rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden"
          aria-hidden
        >
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-semibold leading-tight text-[var(--text)] sm:text-2xl">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-text)]">
            {vin ? <span>VIN: {vin}</span> : null}
            {status ? (
              <StatusBadge variant={STATUS_VARIANT[status] ?? "neutral"}>
                {status}
              </StatusBadge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="gap-1.5"
            aria-label="Print cost ledger"
            onClick={() => printCostLedger(vehicleId, title, vin)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            </svg>
            Print
          </Button>
          {canWrite && (
            <Link href={`/inventory/${vehicleId}/edit`}>
              <Button size="sm">Edit Vehicle</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tab row: Overview (costs, active), Details, Media, Pricing, Recon, History */}
      <nav className="flex flex-wrap items-center gap-0 border-t border-[var(--border)] pt-0 -mb-px" aria-label="Vehicle sections">
        {[
          { id: "costs", label: "Overview", href: null },
          { id: "overview", label: "Details", href: `/inventory/${vehicleId}` },
          { id: "media", label: "Media", href: `/inventory/${vehicleId}/edit` },
          { id: "pricing", label: "Pricing", href: `/inventory/${vehicleId}` },
          { id: "recon", label: "Recon", href: `/inventory/${vehicleId}` },
          { id: "history", label: "History", href: `/inventory/${vehicleId}` },
        ].map((tab) =>
          tab.href ? (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                "text-[var(--text-soft)] hover:text-[var(--text)] border-transparent hover:bg-[var(--surface-2)]"
              )}
            >
              {tab.label}
            </Link>
          ) : (
            <span
              key={tab.id}
              className={cn(
                "px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px",
                "text-[var(--accent)] border-[var(--accent)] bg-[var(--surface-2)]/50"
              )}
              aria-current="page"
            >
              {tab.label}
            </span>
          )
        )}
        <span className="px-3 py-2.5 text-sm text-[var(--muted-text)]" aria-hidden>…</span>
      </nav>
    </header>
  );
}
