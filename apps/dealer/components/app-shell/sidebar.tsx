"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/contexts/session-context";

const NAV_ITEMS: { href: string; label: string; permission: string | string[] }[] = [
  { href: "/dashboard", label: "Dashboard", permission: ["customers.read", "crm.read"] },
  { href: "/inventory", label: "Inventory", permission: "inventory.read" },
  { href: "/customers", label: "Customers", permission: "customers.read" },
  { href: "/deals", label: "Deals", permission: "deals.read" },
  { href: "/crm", label: "Marketing", permission: "crm.read" },
  { href: "/admin/dealership", label: "Admin", permission: "admin.dealership.read" },
  { href: "/files", label: "Favorites", permission: "documents.read" },
  { href: "/reports", label: "Pending Print", permission: "reports.read" },
];

function NavIcon({ label, className }: { label: string; className: string }) {
  switch (label) {
    case "Dashboard":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
    case "Inventory":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case "Customers":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    case "Deals":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "Marketing":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13a3 3 0 100-6M12 8c0 1.657-.895 3-2 3S8 9.657 8 8s.895-3 2-3 2 1.343 2 3z" />
        </svg>
      );
    case "Admin":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "Favorites":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      );
    case "Pending Print":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2h-2m-4-1V9a2 2 0 012-2h2a2 2 0 012 2v1m-6 10h2a2 2 0 002-2v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v4h10z" />
        </svg>
      );
    default:
      return null;
  }
}

export function Sidebar() {
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
  const navBaseClasses =
    "relative flex items-center gap-3 h-11 rounded-[14px] px-3 transition-colors duration-150 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]";
  const activeClasses =
    "bg-[var(--sidebar-active)] text-[var(--sidebar-text-strong)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] shadow-inner";

  return (
    <div className="h-full w-[272px]">
      <aside
        className="relative h-full rounded-l-[24px] rounded-r-none overflow-hidden border-r border-white/5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] flex flex-col bg-[linear-gradient(180deg,var(--sidebar-bg-1)_0%,var(--sidebar-bg-2)_100%)] before:content-[''] before:absolute before:inset-0 before:bg-[linear-gradient(180deg,var(--sidebar-sheen)_0%,transparent_40%,transparent)] before:pointer-events-none before:z-[1] after:content-[''] after:absolute after:inset-0 after:bg-[radial-gradient(120%_90%_at_20%_0%,transparent_0%,var(--sidebar-vignette)_70%)] after:pointer-events-none after:z-[1]"
        aria-label="Main navigation"
      >

        <div className="relative z-10 flex items-center justify-between px-3 pt-3">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full bg-[rgba(59,130,246,0.15)] flex items-center justify-center" aria-hidden>
              <svg className="h-4 w-4 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10.1-4 4 4 0 00-4-4V5a4 4 0 00-4-4H5a4 4 0 00-4 4v6a4 4 0 004 4z" />
              </svg>
            </span>
            <span className="text-sm font-semibold tracking-wide text-white/90">DMS AUTO</span>
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-full hover:bg-white/5 flex items-center justify-center"
            aria-label="Toggle sidebar"
          >
            <svg className="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <nav className="relative z-10 mt-4 px-2 space-y-2" aria-label="Main">
        {showPlatformAdmin && (
          <>
              <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                Platform Admin
              </span>
              <Link
                href="/platform/dealerships"
                className={`${navBaseClasses} ${
                  pathname === "/platform/dealerships" || pathname?.startsWith("/platform/dealerships/")
                    ? activeClasses
                    : ""
                }`}
              >
                {(pathname === "/platform/dealerships" || pathname?.startsWith("/platform/dealerships/")) && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <span className="text-sm font-medium">Dealerships</span>
              </Link>
              <Link
                href="/platform/users"
                className={`${navBaseClasses} ${
                  pathname === "/platform/users" || pathname?.startsWith("/platform/users/")
                    ? activeClasses
                    : ""
                }`}
              >
                {(pathname === "/platform/users" || pathname?.startsWith("/platform/users/")) && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <span className="text-sm font-medium">Users</span>
              </Link>
              <Link
                href="/platform/invites"
                className={`${navBaseClasses} ${
                  pathname === "/platform/invites" || pathname?.startsWith("/platform/invites/")
                    ? activeClasses
                    : ""
                }`}
              >
                {(pathname === "/platform/invites" || pathname?.startsWith("/platform/invites/")) && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <span className="text-sm font-medium">Invites</span>
              </Link>
              <div className="my-3 mx-3 border-t border-[var(--sidebar-hairline)]" />
            </>
          )}
          {primaryItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${navBaseClasses} ${
                  isActive
                    ? activeClasses
                    : ""
                }`}
              >
                {isActive && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <NavIcon
                  label={item.label}
                  className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-white" : "text-white/70"}`}
                />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}

          <div className="my-3 mx-3 border-t border-[var(--sidebar-hairline)]" />

          {secondaryItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${navBaseClasses} ${
                  isActive
                    ? activeClasses
                    : ""
                }`}
              >
                {isActive && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-1 rounded-full bg-[rgba(59,130,246,0.95)]" />
                )}
                <NavIcon
                  label={item.label}
                  className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-white" : "text-white/70"}`}
                />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="relative z-10 mt-auto p-3">
          <div className="h-11 rounded-[14px] bg-white/5 hover:bg-[rgba(255,255,255,0.07)] transition px-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-7 w-7 rounded-full bg-[rgba(59,130,246,0.18)] flex items-center justify-center" aria-hidden>
                <svg className="h-3.5 w-3.5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </span>
              <span className="truncate text-sm font-semibold text-white/85">
                {activeDealership?.name ?? "Sunset Auto"}
              </span>
            </div>
            <button
              type="button"
              className="h-8 w-8 rounded-full hover:bg-white/5 flex items-center justify-center shrink-0"
              aria-label="Dealership settings"
            >
              <svg className="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
