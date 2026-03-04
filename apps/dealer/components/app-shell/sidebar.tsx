"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/contexts/session-context";

const NAV_ITEMS: { href: string; label: string; permission: string | string[] }[] = [
  { href: "/dashboard", label: "Dashboard", permission: ["customers.read", "crm.read"] },
  { href: "/inventory", label: "Inventory", permission: "inventory.read" },
  { href: "/customers", label: "Customers", permission: "customers.read" },
  { href: "/deals", label: "Deals", permission: "deals.read" },
  { href: "/crm", label: "CRM Board", permission: "crm.read" },
  { href: "/crm/opportunities", label: "Opportunities", permission: "crm.read" },
  { href: "/crm/automations", label: "Automations", permission: "crm.read" },
  { href: "/crm/sequences", label: "Sequences", permission: "crm.read" },
  { href: "/crm/jobs", label: "Jobs", permission: "crm.read" },
  { href: "/lenders", label: "Lenders", permission: "lenders.read" },
  { href: "/reports", label: "Reports", permission: "reports.read" },
  { href: "/admin/dealership", label: "Dealership", permission: "admin.dealership.read" },
  { href: "/admin/users", label: "Users", permission: "admin.memberships.read" },
  { href: "/admin/roles", label: "Roles", permission: "admin.roles.read" },
  { href: "/admin/audit", label: "Access / Audit log", permission: "admin.audit.read" },
  { href: "/files", label: "Files", permission: "documents.read" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission, platformAdmin } = useSession();

  const visible = NAV_ITEMS.filter((item) =>
    Array.isArray(item.permission)
      ? item.permission.some((p) => hasPermission(p))
      : hasPermission(item.permission)
  );
  const showPlatformAdmin = platformAdmin?.isAdmin === true;

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-zinc-700/50 bg-zinc-900">
      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Main">
        {showPlatformAdmin && (
          <>
            <span className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Platform Admin
            </span>
            <Link
              href="/platform/dealerships"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/platform/dealerships" || pathname?.startsWith("/platform/dealerships/")
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              Dealerships
            </Link>
            <Link
              href="/platform/users"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/platform/users" || pathname?.startsWith("/platform/users/")
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              Users
            </Link>
            <Link
              href="/platform/invites"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/platform/invites" || pathname?.startsWith("/platform/invites/")
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              Invites
            </Link>
          </>
        )}
        {visible.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
