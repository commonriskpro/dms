"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Plus, ChevronDown, Car, UserPlus, FileText } from "@/lib/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/modules/search/ui/GlobalSearch";
import { useTheme } from "@/lib/ui/theme/theme-provider";
import { navTokens } from "@/lib/ui/tokens";
import { useSession } from "@/contexts/session-context";

const QUICK_CREATE_ITEMS: Array<{
  label: string;
  href: string;
  permission: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { label: "Add Vehicle", href: "/inventory/new", permission: "inventory.write", icon: Car },
  { label: "Add Lead", href: "/customers/new", permission: "customers.write", icon: UserPlus },
  { label: "New Deal", href: "/deals/new", permission: "deals.write", icon: FileText },
];

export function TopCommandBar() {
  const router = useRouter();
  const { user, activeDealership, lifecycleStatus, hasPermission } = useSession();
  const { theme, toggleTheme } = useTheme();

  const quickCreateActions = React.useMemo(
    () => QUICK_CREATE_ITEMS.filter((item) => hasPermission(item.permission)),
    [hasPermission]
  );

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const initials = (user?.fullName ?? "U").trim().slice(0, 2).toUpperCase() || "U";

  return (
    <header className={navTokens.commandBar}>
      <div className="grid h-full grid-cols-[minmax(280px,560px)_1fr] items-center gap-4">
        <GlobalSearch />
        <div className="flex items-center justify-end gap-2">
          {activeDealership ? (
            <span className="hidden max-w-[220px] truncate text-sm text-[var(--muted-text)] md:inline" title="Active dealership">
              {activeDealership.name}
            </span>
          ) : null}
          {lifecycleStatus ? (
            <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted-text)] md:inline">
              {lifecycleStatus}
            </span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)] data-[state=open]:bg-[var(--surface-2)]"
              aria-label="Quick create menu"
            >
              <Plus size={14} />
              Quick Create
              <ChevronDown size={12} className="opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              {quickCreateActions.length > 0 ? (
                quickCreateActions.map(({ label, href, icon: Icon }) => (
                    <DropdownMenuItem>
                      <Link href={href} className="flex items-center gap-2">
                        <Icon size={14} className="shrink-0 opacity-70" />
                        {label}
                      </Link>
                    </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled className="text-[var(--muted-text)]">
                  No create actions available
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="text-xs font-semibold">{theme === "dark" ? "L" : "D"}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
            aria-label="Notifications"
          >
            <Bell size={15} />
          </button>
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--text)] text-xs font-semibold text-[var(--surface)]">
            {initials}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-2 text-sm text-[var(--muted-text)] hover:text-[var(--text)]"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
