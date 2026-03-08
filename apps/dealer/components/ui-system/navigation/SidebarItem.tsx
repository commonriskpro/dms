import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { navTokens } from "@/lib/ui/tokens";
import type { LucideIcon } from "@/lib/ui/icons";

export type SidebarItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  collapsed?: boolean;
};

export function SidebarItem({
  href,
  label,
  icon: Icon,
  active = false,
  collapsed = false,
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
      <Icon size={20} className={cn("shrink-0", active ? "text-[var(--sidebar-text-strong)]" : "text-[var(--sidebar-text)]")} aria-hidden />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}
