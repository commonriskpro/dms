"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { navTokens } from "@/lib/ui/tokens";
import type { LucideIcon } from "@/lib/ui/icons";
import type { NavSubItemConfig } from "./navigation.config";

export type SidebarItemExpandableProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  items: NavSubItemConfig[];
  collapsed?: boolean;
};

export function SidebarItemExpandable({
  href,
  label,
  icon: Icon,
  items,
  collapsed = false,
}: SidebarItemExpandableProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  /** Match a nav href that may include a query string (e.g. /inventory?view=list) */
  function isHrefActive(h: string, exactPath = false) {
    const [hPath, hQuery] = h.split("?");
    if (!hQuery) {
      if (exactPath) return pathname === hPath;
      return pathname === hPath || pathname?.startsWith(hPath + "/");
    }
    const hParams = new URLSearchParams(hQuery);
    for (const [k, v] of hParams.entries()) {
      if (searchParams.get(k) !== v) return false;
    }
    return exactPath ? pathname === hPath : pathname === hPath || pathname?.startsWith(hPath + "/");
  }

  const isParentActive = isHrefActive(href);

  const [open, setOpen] = React.useState(isParentActive);

  // Auto-expand when navigating into this section
  React.useEffect(() => {
    if (isParentActive) setOpen(true);
  }, [isParentActive]);

  if (collapsed) {
    return (
      <Link
        href={href}
        title={label}
        className={cn(
          navTokens.sidebarItem,
          "h-10 w-10 justify-center px-0",
          isParentActive && navTokens.sidebarItemActive
        )}
      >
        <Icon
          size={18}
          className={cn("shrink-0", isParentActive ? "text-[var(--sidebar-text-strong)]" : "text-[var(--sidebar-text)]")}
          aria-hidden
        />
      </Link>
    );
  }

  return (
    <div>
      {/* Parent row — navigates to href and toggles sub-menu */}
      <Link
        href={href}
        onClick={() => setOpen(true)}
        className={cn(
          navTokens.sidebarItem,
          "w-full",
          isParentActive && navTokens.sidebarItemActive
        )}
        aria-expanded={open}
      >
        <Icon
          size={18}
          className={cn("shrink-0", isParentActive ? "text-[var(--sidebar-text-strong)]" : "text-[var(--sidebar-text)]")}
          aria-hidden
        />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronRight
          size={14}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
          className={cn(
            "shrink-0 text-[var(--sidebar-text)] transition-transform duration-150 rounded p-0.5 hover:bg-[var(--sidebar-hover)]",
            open && "rotate-90"
          )}
          aria-hidden
        />
      </Link>

      {/* Sub-items */}
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-9">
          {items.map(({ href: childHref, label: childLabel }) => {
            const childActive = isHrefActive(childHref, childHref === href);
            return (
              <Link
                key={childHref}
                href={childHref}
                className={cn(
                  "flex h-8 items-center rounded-[8px] px-2.5 text-sm font-medium transition-colors",
                  childActive
                    ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text-strong)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
                    : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
                )}
              >
                {childLabel}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
