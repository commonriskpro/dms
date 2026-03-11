import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { navTokens } from "@/lib/ui/tokens";
import type { LucideIcon } from "@/lib/ui/icons";

type SidebarItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed?: boolean;
  showChevron?: boolean;
};

export function SidebarItem({
  href,
  label,
  icon: Icon,
  active = false,
  collapsed = false,
  showChevron = false,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        navTokens.sidebarItem,
        collapsed && "h-10 w-10 justify-center px-0",
        active && navTokens.sidebarItemActive
      )}
    >
      <Icon size={18} className={cn("shrink-0", active ? "text-[var(--sidebar-text-strong)]" : "text-[var(--sidebar-text)]")} aria-hidden />
      {!collapsed ? <span className="truncate">{label}</span> : null}
      {!collapsed && showChevron ? <ChevronRight size={16} className="ml-auto shrink-0 text-[var(--sidebar-text)]/80" aria-hidden /> : null}
    </Link>
  );
}
