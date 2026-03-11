"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Car, Plus, UserPlus, FileText } from "@/lib/ui/icons";
import AnimatedDropdown from "@/components/ui/animated-dropdown";
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
          <AnimatedDropdown
            text="Quick Create"
            align="right"
            buttonVariant="primary"
            buttonSize="sm"
            buttonClassName="h-9 rounded-[10px] px-3"
            triggerStartIcon={Plus}
            items={
              quickCreateActions.length > 0
                ? quickCreateActions.map(({ label, href, icon }) => ({
                    name: label,
                    link: href,
                    icon,
                  }))
                : [{ name: "No create actions available", disabled: true }]
            }
          />
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-text)] cursor-default opacity-50"
            aria-label="Notifications (coming soon)"
            title="Notifications coming soon"
            disabled
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
