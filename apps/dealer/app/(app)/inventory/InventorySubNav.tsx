"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACQUISITION_LINKS: { href: string; label: string }[] = [
  { href: "/inventory/acquisition", label: "Pipeline" },
  { href: "/inventory/appraisals", label: "Appraisals" },
  { href: "/inventory/auctions", label: "Auctions" },
  { href: "/inventory/auction-purchases", label: "Auction purchases" },
];

export function InventorySubNav() {
  const pathname = usePathname();
  const isAcquisitionSection =
    pathname?.startsWith("/inventory/acquisition") ||
    pathname?.startsWith("/inventory/appraisals") ||
    pathname?.startsWith("/inventory/auctions") ||
    pathname?.startsWith("/inventory/auction-purchases");

  if (!isAcquisitionSection) return null;

  return (
    <nav
      className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-[var(--space-page-x)] py-2"
      aria-label="Acquisition"
    >
      <span className="mr-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-text)]">
        Acquisition
      </span>
      {ACQUISITION_LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname?.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                : "text-[var(--text)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
