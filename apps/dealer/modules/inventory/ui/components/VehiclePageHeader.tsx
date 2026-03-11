"use client";
import Link from "next/link";
import { ChevronLeft } from "@/lib/ui/icons";
import { StatusBadge } from "@/components/ui-system/tables";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client/http";
import { formatCents } from "@/lib/money";
import type { VehicleDetailTabId } from "./VehicleDetailTabs";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "danger" | "neutral"> = {
  AVAILABLE: "success",
  HOLD: "warning",
  SOLD: "neutral",
  WHOLESALE: "info",
  REPAIR: "warning",
  ARCHIVED: "danger",
};

const TABS: { id: VehicleDetailTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "media", label: "Media" },
  { id: "costs", label: "Costs" },
];

function tabLabel(tab: VehicleDetailTabId) {
  return TABS.find((item) => item.id === tab)?.label ?? "Overview";
}

export type VehiclePageHeaderProps = {
  vehicleId: string;
  title: string;
  vin: string | null;
  status: string | null;
  thumbnailUrl?: string | null;
  canWrite?: boolean;
  activeTab: VehicleDetailTabId;
  onTabChange: (tab: VehicleDetailTabId) => void;
  className?: string;
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
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

export function VehiclePageHeader({
  vehicleId,
  title,
  vin,
  status,
  thumbnailUrl,
  canWrite = false,
  activeTab,
  onTabChange,
  className,
}: VehiclePageHeaderProps) {
  return (
    <header
      className={cn(
        "surface-noise rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-[var(--shadow-card)] sm:px-5 sm:py-4",
        className
      )}
    >
      <div className="flex flex-col gap-3 min-[1800px]:gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2.5">
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-soft)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-[var(--radius-button)]"
              aria-label="Back to inventory"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to inventory
            </Link>
            <div className="flex min-w-0 items-start gap-3">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-input)] border border-[var(--border)] bg-[var(--surface-2)] min-[1800px]:h-16 min-[1800px]:w-24">
                {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Inventory operating record</p>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[36px]">{title}</h1>
                  {status ? (
                    <StatusBadge variant={STATUS_VARIANT[status] ?? "neutral"}>{status}</StatusBadge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--muted-text)]">
                  {vin ? <span>VIN: {vin}</span> : null}
                  <span>List-driven vehicle workflow</span>
                  <span>{activeTab === "overview" ? "Command center open" : `${tabLabel(activeTab)} active`}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              className="h-8 gap-1.5 px-3"
              aria-label="Print cost ledger"
              onClick={() => printCostLedger(vehicleId, title, vin)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              </svg>
              Print costs
            </Button>
            {canWrite && (
              <Link href={`${inventoryDetailPath(vehicleId)}/edit`}>
                <Button size="sm" className="h-8 px-3">Edit Vehicle</Button>
              </Link>
            )}
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3" aria-label="Vehicle sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted-text)] hover:text-[var(--text)]"
              )}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
