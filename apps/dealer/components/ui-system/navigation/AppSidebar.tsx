"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { Menu, Settings } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { navTokens } from "@/lib/ui/tokens";
import { APP_NAV_GROUPS } from "./navigation.config";
import { SidebarItem } from "./SidebarItem";
import { SidebarItemExpandable } from "./SidebarItemExpandable";

type AppSidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
};

function hasAnyPermission(hasPermission: (permission: string) => boolean, permissions?: string[]) {
  if (!permissions || permissions.length === 0) return true;
  return permissions.some((permission) => hasPermission(permission));
}

export function AppSidebar({ collapsed = false, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const { hasPermission, activeDealership } = useSession();

  return (
    <aside className={cn(navTokens.sidebarRoot, "flex h-full flex-col")} aria-label="Main navigation">
      <div className={cn("flex items-center border-b border-[var(--sidebar-hairline)]", collapsed ? "justify-center gap-1 p-2" : "justify-between p-3")}>
        {!collapsed ? <div className="text-sm font-semibold tracking-[0.08em] text-[var(--sidebar-text-strong)]">Dealer OS</div> : null}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu size={16} />
        </button>
      </div>

      <nav className={cn("flex-1 space-y-1 overflow-y-auto py-2", collapsed ? "px-2" : "px-3")} aria-label="Primary">
        {APP_NAV_GROUPS.map((group, groupIdx) => {
          const items = group.items.filter((item) => hasAnyPermission(hasPermission, item.permissions));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="space-y-1">
              {groupIdx > 0 && <div className={cn("my-2 h-px bg-[var(--sidebar-hairline)]", collapsed ? "mx-0" : "mx-1")} />}
              {items.map((item) => {
                if (item.children && item.children.length > 0) {
                  return (
                    <SidebarItemExpandable
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      children={item.children}
                      collapsed={collapsed}
                    />
                  );
                }
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <SidebarItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    active={active}
                    collapsed={collapsed}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-[var(--sidebar-hairline)]", collapsed ? "p-2" : "p-3")}>
        <div className={cn("flex items-center rounded-[10px] bg-[var(--sidebar-hover)]", collapsed ? "h-10 w-10 justify-center" : "h-10 justify-between px-3")}>
          {!collapsed ? <span className="truncate text-sm text-[var(--sidebar-text)]">{activeDealership?.name ?? "Dealership"}</span> : null}
          <Link
            href="/settings"
            aria-label="Settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
          >
            <Settings size={16} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
