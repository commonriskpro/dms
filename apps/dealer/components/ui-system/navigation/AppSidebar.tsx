"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { Car, CircleAlert, Menu, Pencil, Settings, Users } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { navTokens } from "@/lib/ui/tokens";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { hasPermission, activeDealership, user } = useSession();
  const userInitials = (user?.fullName ?? user?.email ?? "U")
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={cn(navTokens.sidebarRoot, "flex h-full flex-col")}
      aria-label="Main navigation"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <div className={cn("h-14 border-b border-[var(--sidebar-hairline)]", collapsed ? "px-2" : "px-3")}>
        <div className={cn("flex h-full items-center", collapsed ? "justify-center gap-1" : "justify-between")}>
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/12 text-[var(--sidebar-text-strong)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]">
                <Car size={18} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-[var(--sidebar-text-strong)]">DealerOS</div>
                <div className="truncate text-xs text-[var(--sidebar-text)]/80">{activeDealership?.name ?? "Dealership"}</div>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={16} />
          </button>
        </div>
      </div>

      <nav className={cn("flex-1 space-y-1 overflow-y-auto py-2", collapsed ? "px-2" : "px-2.5")} aria-label="Primary">
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
                    showChevron={item.showChevron}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-[var(--sidebar-hairline)]", collapsed ? "p-2" : "p-2.5")}>
        <div className={cn("rounded-[12px] bg-white/5", collapsed ? "p-2" : "p-3")}>
          {collapsed ? (
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/14 text-xs font-semibold text-[var(--sidebar-text-strong)]">
              {userInitials}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/14 text-sm font-semibold text-[var(--sidebar-text-strong)]">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-[var(--sidebar-text-strong)]">
                  {user?.fullName ?? "User"}
                </div>
                <div className="truncate text-sm text-[var(--sidebar-text)]/75">
                  {activeDealership?.name ?? "Dealership"}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/12 text-[var(--sidebar-text-strong)]">
                  <Pencil size={14} />
                </span>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#e47c4a] px-1.5 text-xs font-semibold text-white">
                  3
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/12 text-[var(--sidebar-text-strong)]">
                  <CircleAlert size={14} />
                </span>
              </div>
            </div>
          )}
          {!collapsed ? (
            <div className="mt-3 flex items-center justify-between rounded-[10px] border border-white/10 bg-black/10 px-2 py-1.5">
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
                aria-label="Collapse sidebar"
              >
                <Menu size={14} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
                  aria-label="Admin menu"
                >
                  <Settings size={15} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[170px]">
                  {hasPermission("admin.settings.manage") ? (
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex w-full items-center gap-2">
                        <Settings size={14} />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {hasPermission("admin.roles.read") || hasPermission("admin.settings.manage") ? (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/users" className="flex w-full items-center gap-2">
                        <Users size={14} />
                        Users &amp; Roles
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {!hasPermission("admin.settings.manage") &&
                  !hasPermission("admin.roles.read") ? (
                    <DropdownMenuItem disabled>No admin actions</DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
