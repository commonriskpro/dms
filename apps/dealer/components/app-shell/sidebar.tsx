"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import {
  LayoutDashboard,
  Car,
  Users,
  Handshake,
  Megaphone,
  BarChart3,
  Settings,
  Star,
  Building,
  Menu,
  Mail,
  type LucideIcon,
} from "@/lib/ui/icons";

const NAV_ITEMS: {
  href: string;
  label: string;
  permission: string | string[];
  icon: LucideIcon;
}[] = [
  { href: "/dashboard", label: "Dashboard", permission: ["customers.read", "crm.read"], icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", permission: "inventory.read", icon: Car },
  { href: "/customers", label: "Customers", permission: "customers.read", icon: Users },
  { href: "/deals", label: "Deals", permission: "deals.read", icon: Handshake },
  { href: "/crm", label: "Marketing", permission: "crm.read", icon: Megaphone },
  { href: "/admin/dealership", label: "Admin", permission: "admin.dealership.read", icon: Settings },
  { href: "/files", label: "Favorites", permission: "documents.read", icon: Star },
  { href: "/reports", label: "Pending Print", permission: "reports.read", icon: BarChart3 },
];

const SIDEBAR_ICON_SIZE = 18;

export type SidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
};

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { hasPermission, platformAdmin, activeDealership } = useSession();

  const visible = NAV_ITEMS.filter((item) =>
    Array.isArray(item.permission)
      ? item.permission.some((p) => hasPermission(p))
      : hasPermission(item.permission)
  );
  const showPlatformAdmin = platformAdmin?.isAdmin === true;
  const primaryLabels = new Set(["Dashboard", "Inventory", "Customers", "Deals", "Marketing", "Admin"]);
  const primaryItems = visible.filter((item) => primaryLabels.has(item.label));
  const secondaryItems = visible.filter((item) => !primaryLabels.has(item.label));
  const navBaseClasses = collapsed
    ? "relative flex items-center justify-center h-11 w-11 rounded-[14px] transition-colors duration-150 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] shrink-0"
    : "relative flex items-center gap-3 h-11 rounded-[14px] px-3 transition-colors duration-150 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]";
  const activeClasses =
    "bg-[var(--sidebar-active)] text-[var(--sidebar-text-strong)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] shadow-inner";

  return (
    <div className="h-full w-full min-w-0">
      <aside
        className="relative h-full rounded-r-none overflow-hidden border-r border-white/5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] flex flex-col bg-[linear-gradient(180deg,var(--sidebar-bg-1)_0%,var(--sidebar-bg-2)_100%)] before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(180deg,var(--sidebar-sheen)_0%,transparent_40%,transparent)] before:pointer-events-none before:z-[1] after:content-[''] after:absolute after:inset-0 after:bg-[radial-gradient(120%_90%_at_20%_0%,transparent_0%,var(--sidebar-vignette)_70%)] after:pointer-events-none after:z-[1]"
        aria-label="Main navigation"
      >

        <div className={`relative z-10 flex items-center pt-3 ${collapsed ? "flex-col gap-2 px-0" : "justify-between px-3"}`}>
          <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
            <span className="h-8 w-8 rounded-full bg-[rgba(59,130,246,0.15)] flex items-center justify-center shrink-0" aria-hidden>
              <svg className="h-4 w-4 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10.1-4 4 4 0 00-4-4V5a4 4 0 00-4-4H5a4 4 0 00-4 4v6a4 4 0 004 4z" />
              </svg>
            </span>
            {!collapsed && (
              <span className="text-sm font-semibold tracking-wide text-white/90">DMS AUTO</span>
            )}
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="h-8 w-8 rounded-full hover:bg-white/5 flex items-center justify-center shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={16} className="text-white/70" aria-hidden />
          </button>
        </div>

        <nav className={`relative z-10 mt-4 space-y-2 ${collapsed ? "px-2 flex flex-col items-center" : "px-2"}`} aria-label="Main">
        {showPlatformAdmin && (
          <>
              {!collapsed && (
                <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Platform Admin
                </span>
              )}
              <Link
                href="/platform/dealerships"
                title={collapsed ? "Dealerships" : undefined}
                className={`${navBaseClasses} ${
                  pathname === "/platform/dealerships" || pathname?.startsWith("/platform/dealerships/")
                    ? activeClasses
                    : ""
                }`}
              >
                {(pathname === "/platform/dealerships" || pathname?.startsWith("/platform/dealerships/")) && !collapsed && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <Building size={SIDEBAR_ICON_SIZE} className={`shrink-0 ${pathname === "/platform/dealerships" || pathname?.startsWith("/platform/dealerships/") ? "text-white" : "text-white/70"}`} aria-hidden />
                {!collapsed && <span className="text-sm font-medium">Dealerships</span>}
              </Link>
              <Link
                href="/platform/users"
                title={collapsed ? "Users" : undefined}
                className={`${navBaseClasses} ${
                  pathname === "/platform/users" || pathname?.startsWith("/platform/users/")
                    ? activeClasses
                    : ""
                }`}
              >
                {(pathname === "/platform/users" || pathname?.startsWith("/platform/users/")) && !collapsed && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <Users size={SIDEBAR_ICON_SIZE} className={`shrink-0 ${pathname === "/platform/users" || pathname?.startsWith("/platform/users/") ? "text-white" : "text-white/70"}`} aria-hidden />
                {!collapsed && <span className="text-sm font-medium">Users</span>}
              </Link>
              <Link
                href="/platform/invites"
                title={collapsed ? "Invites" : undefined}
                className={`${navBaseClasses} ${
                  pathname === "/platform/invites" || pathname?.startsWith("/platform/invites/")
                    ? activeClasses
                    : ""
                }`}
              >
                {(pathname === "/platform/invites" || pathname?.startsWith("/platform/invites/")) && !collapsed && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <Mail size={SIDEBAR_ICON_SIZE} className={`shrink-0 ${pathname === "/platform/invites" || pathname?.startsWith("/platform/invites/") ? "text-white" : "text-white/70"}`} aria-hidden />
                {!collapsed && <span className="text-sm font-medium">Invites</span>}
              </Link>
              <div className={`border-t border-[var(--sidebar-hairline)] ${collapsed ? "my-2 w-8" : "my-3 mx-3"}`} />
            </>
          )}
          {primaryItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`${navBaseClasses} ${
                  isActive
                    ? activeClasses
                    : ""
                }`}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <item.icon
                  size={SIDEBAR_ICON_SIZE}
                  className={`shrink-0 ${isActive ? "text-white" : "text-white/70"}`}
                  aria-hidden
                />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}

          <div className={`border-t border-[var(--sidebar-hairline)] ${collapsed ? "my-2 w-8" : "my-3 mx-3"}`} />

          {secondaryItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`${navBaseClasses} ${
                  isActive
                    ? activeClasses
                    : ""
                }`}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <item.icon
                  size={SIDEBAR_ICON_SIZE}
                  className={`shrink-0 ${isActive ? "text-white" : "text-white/70"}`}
                  aria-hidden
                />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`relative z-10 mt-auto ${collapsed ? "p-2 flex justify-center" : "p-3"}`}>
          <div className={`rounded-[14px] bg-white/5 hover:bg-[rgba(255,255,255,0.07)] transition flex items-center ${collapsed ? "h-11 w-11 justify-center" : "h-11 px-3 justify-between w-full"}`}>
            {!collapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-sm font-semibold text-white/85">
                  {activeDealership?.name ?? "Sunset Auto"}
                </span>
              </div>
            )}
            <Link
              href="/settings"
              title={collapsed ? "Settings" : undefined}
              className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-150 ${
                pathname?.startsWith("/settings")
                  ? "bg-[var(--sidebar-active)] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]"
                  : "hover:bg-white/5 text-white/70"
              }`}
              aria-label="Settings"
            >
              <Settings size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
