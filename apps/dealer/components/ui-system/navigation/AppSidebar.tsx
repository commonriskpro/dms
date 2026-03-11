"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { Car, CircleAlert, Menu, Pencil, Settings, Users } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";
import { navTokens } from "@/lib/ui/tokens";
import AnimatedDropdown from "@/components/ui/animated-dropdown";
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
      style={{
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        backgroundColor: "var(--sidebar-base-bg)",
        backgroundImage: [
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E\")",
          "linear-gradient(to bottom, transparent 40%, color-mix(in srgb, var(--accent) 6%, transparent) 100%)",
        ].join(", "),
        backgroundSize: "180px 180px, 100% 100%",
        backgroundRepeat: "repeat, no-repeat",
      }}
    >
      <div className={cn("h-14 border-b border-[var(--sidebar-hairline)]", collapsed ? "px-1.5" : "px-2.5")}>
        <div className={cn("flex h-full items-center", collapsed ? "justify-center gap-1" : "justify-between")}>
          {!collapsed ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/12 text-[var(--sidebar-text-strong)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]">
                <Car size={16} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-[var(--sidebar-text-strong)]">DealerOS</div>
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

      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto py-1.5", collapsed ? "px-1.5" : "px-2")} aria-label="Primary">
        {APP_NAV_GROUPS.map((group, groupIdx) => {
          const items = group.items.filter((item) => hasAnyPermission(hasPermission, item.permissions));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="space-y-1">
              {groupIdx > 0 && <div className={cn("my-1.5 h-px bg-[var(--sidebar-hairline)]", collapsed ? "mx-0" : "mx-1")} />}
              {items.map((item) => {
                if (item.children && item.children.length > 0) {
                  const visibleChildren = item.children.filter((child) =>
                    hasAnyPermission(hasPermission, child.permissions)
                  );
                  if (visibleChildren.length === 0) return null;
                  return (
                  <SidebarItemExpandable
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      items={visibleChildren}
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

      <div className={cn("border-t border-[var(--sidebar-hairline)]", collapsed ? "p-1.5" : "p-2")}>
        <div className={cn("rounded-[10px] bg-white/5", collapsed ? "p-1.5" : "p-2.5")}>
          {collapsed ? (
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/14 text-xs font-semibold text-[var(--sidebar-text-strong)]">
              {userInitials}
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/14 text-xs font-semibold text-[var(--sidebar-text-strong)]">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-[var(--sidebar-text-strong)]">
                  {user?.fullName ?? "User"}
                </div>
                <div className="truncate text-xs text-[var(--sidebar-text)]/75">
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
            <div className="mt-2 flex items-center justify-between rounded-[9px] border border-white/10 bg-black/10 px-1.5 py-1">
              <button
                type="button"
                onClick={onToggle}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
                aria-label="Collapse sidebar"
              >
                <Menu size={14} />
              </button>
              <AnimatedDropdown
                text="Admin menu"
                align="right"
                buttonVariant="ghost"
                buttonSize="sm"
                buttonClassName="h-8 w-8 rounded-md p-0 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]"
                triggerContent={<Settings size={15} />}
                showChevron={false}
                items={[
                  ...(hasPermission("admin.settings.manage")
                    ? [{ name: "Settings", link: "/settings", icon: Settings }]
                    : []),
                  ...(hasPermission("admin.roles.read") || hasPermission("admin.settings.manage")
                    ? [{ name: "Users & Roles", link: "/admin/users", icon: Users }]
                    : []),
                  ...(!hasPermission("admin.settings.manage") && !hasPermission("admin.roles.read")
                    ? [{ name: "No admin actions", disabled: true }]
                    : []),
                ]}
              />
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
