"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, AlertTriangle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/client/http";
import type { VehicleListItem } from "@/modules/inventory/service/inventory-page";
import { inventoryDetailPath } from "@/lib/routes/detail-paths";

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    AVAILABLE: "Available",
    REPAIR: "In Recon",
    HOLD: "On Hold",
    ARCHIVED: "Archived",
    WHOLESALE: "Wholesale",
  };
  return map[s] ?? s;
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "AVAILABLE":
      return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
    case "REPAIR":
    case "HOLD":
      return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
    case "ARCHIVED":
      return "bg-red-500/15 text-red-400 border border-red-500/30";
    case "WHOLESALE":
      return "bg-sky-500/15 text-sky-400 border border-sky-500/30";
    default:
      return "bg-[var(--surface-2)] text-[var(--muted-text)] border border-[var(--border)]";
  }
}

export type VehicleCardGridProps = {
  items: VehicleListItem[];
  canWrite: boolean;
};

export function VehicleCardGrid({ items, canWrite }: VehicleCardGridProps) {
  const router = useRouter();
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const fileIds = items
      .map((v) => v.primaryPhotoFileId)
      .filter((id): id is string => id != null);

    if (fileIds.length === 0) return;

    const unique = [...new Set(fileIds)];
    let cancelled = false;

    Promise.all(
      unique.map(async (fid) => {
        try {
          const r = await apiFetch<{ url: string }>(
            `/api/files/signed-url?fileId=${encodeURIComponent(fid)}`
          );
          return [fid, r.url] as const;
        } catch {
          return [fid, ""] as const;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [fid, url] of results) {
        if (url) map[fid] = url;
      }
      setPhotoUrls(map);
    });

    return () => { cancelled = true; };
  }, [items]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-4 min-[2200px]:grid-cols-5">
      {items.map((v) => {
        const title = [v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown";
        const profit = v.salePriceCents - v.costCents;
        const photoUrl = v.primaryPhotoFileId ? photoUrls[v.primaryPhotoFileId] : null;
        const hasPhoto = Boolean(photoUrl);
        const vinDisplay = v.vin ? `#${v.vin.slice(-6).toUpperCase()}` : null;
        const mileageDisplay = v.mileage != null ? `${v.mileage.toLocaleString()} mi` : "0 mi";

        const overviewHref = inventoryDetailPath(v.id);

        return (
          <Link
            key={v.id}
            href={overviewHref}
            className="surface-noise group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--accent)]/40"
          >
            {/* Photo area */}
            <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-[var(--border)] bg-[var(--surface-2)]">
              {hasPhoto ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed vehicle photo URL */}
                  <img
                    src={photoUrl!}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute left-1 top-1 flex gap-0.5">
                    <span className="rounded bg-black/50 px-0.5 py-0.5">
                      <ImageIcon size={9} className="text-white" />
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-[var(--muted-text)]">
                  <ImageIcon size={20} className="opacity-30" />
                  <span className="text-[10px]">No Photo</span>
                  <span className="absolute right-1 top-1 rounded-md bg-amber-500/15 px-1 py-0.5 text-[8px] font-semibold text-amber-400 border border-amber-500/30">
                    Missing Photos
                  </span>
                </div>
              )}
            </div>

            {/* Info area */}
            <div className="flex flex-1 flex-col space-y-2 p-3">
              {/* Stock + Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--accent)]">
                  #{v.stockNumber}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[9px] font-semibold",
                    statusBadgeClass(v.status)
                  )}
                >
                  {statusLabel(v.status)}
                </span>
              </div>

              {/* Title */}
              <p className="line-clamp-1 text-sm font-semibold text-[var(--text)]">{title}</p>

              {/* VIN + Mileage */}
              <p className="text-[11px] text-[var(--muted-text)]">
                {vinDisplay ?? ""} · {mileageDisplay}
              </p>

              {/* Cost / Price / Profit */}
              <div className="grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-2">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Cost</p>
                  <p className="text-[13px] font-bold tabular-nums text-[var(--text)]">
                    {formatCents(String(v.costCents))}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">Price</p>
                  <p className="text-[13px] font-bold tabular-nums text-[var(--text)]">
                    {formatCents(String(v.salePriceCents))}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted-text)]">
                    Profit {profit < 0 && <AlertTriangle size={8} className="inline text-amber-400" />}
                  </p>
                  <p
                    className={cn(
                      "text-[13px] font-bold tabular-nums",
                      profit > 0 ? "text-emerald-400" : profit < 0 ? "text-red-400" : "text-[var(--text)]"
                    )}
                  >
                    {formatCents(String(profit))}
                  </p>
                </div>
              </div>

              {/* Start Deal — stop propagation so card link doesn’t fire */}
              <div
                className="mt-auto border-t border-[var(--border)] pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="h-8 w-full text-[11px]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/deals/new?vehicleId=${v.id}`);
                  }}
                >
                  Start Deal
                </Button>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
