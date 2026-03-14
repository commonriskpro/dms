"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Car, Plus, UserPlus, FileText } from "@/lib/ui/icons";
import AnimatedDropdown from "@/components/ui/animated-dropdown";
import { GlobalSearch } from "@/modules/search/ui/GlobalSearch";
import { useTheme } from "@/lib/ui/theme/theme-provider";
import { navTokens, notificationTokens } from "@/lib/ui/tokens";
import { useSession } from "@/contexts/session-context";
import {
  NotificationItem,
  NotificationPanel,
  NotificationEmptyState,
  NotificationLoadingState,
} from "@/components/ui/notification-primitives";
import { Button } from "@/components/ui/button";

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

type UserNotificationListItem = {
  id: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
};

function getNotificationHref(notification: UserNotificationListItem): string | null {
  if (!notification.entityType || !notification.entityId) return null;
  const entityType = notification.entityType.toLowerCase();
  if (entityType === "deal") return `/deals/${notification.entityId}`;
  if (entityType === "vehicle") return `/inventory/${notification.entityId}`;
  if (entityType === "customer") return `/customers/${notification.entityId}`;
  return null;
}

export function TopCommandBar() {
  const router = useRouter();
  const { user, activeDealership, lifecycleStatus, hasPermission } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = React.useState<UserNotificationListItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = React.useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = React.useState(false);
  const notificationPanelRef = React.useRef<HTMLDivElement>(null);
  const canReadNotifications = hasPermission("notifications.read");

  React.useEffect(() => {
    if (!notificationPanelOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotificationPanelOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(e.target as Node)) {
        setNotificationPanelOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notificationPanelOpen]);

  const quickCreateActions = React.useMemo(
    () => QUICK_CREATE_ITEMS.filter((item) => hasPermission(item.permission)),
    [hasPermission]
  );

  const unreadCount = React.useMemo(
    () => notifications.filter((notification) => notification.readAt == null).length,
    [notifications]
  );

  const fetchNotifications = React.useCallback(async () => {
    if (!canReadNotifications) {
      setNotifications([]);
      return;
    }
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/notifications?limit=10&offset=0", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: { items?: UserNotificationListItem[] };
      };
      setNotifications(payload.data?.items ?? []);
    } finally {
      setNotificationsLoading(false);
    }
  }, [canReadNotifications]);

  React.useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  React.useEffect(() => {
    if (!canReadNotifications) return;
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [canReadNotifications, fetchNotifications]);

  const handleNotificationSelect = React.useCallback(
    async (notification: UserNotificationListItem) => {
      setNotificationPanelOpen(false);
      if (notification.readAt == null) {
        await fetch(`/api/notifications/${notification.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        });
        setNotifications((current) =>
          current.map((entry) =>
            entry.id === notification.id
              ? { ...entry, readAt: new Date().toISOString() }
              : entry
          )
        );
      }
      const href = getNotificationHref(notification);
      if (href) router.push(href);
    },
    [router]
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
            className="glass-field inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text)] hover:bg-[var(--glass-bg-strong)] transition-all duration-200"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="text-xs font-semibold">{theme === "dark" ? "L" : "D"}</span>
          </button>
          {canReadNotifications ? (
            <div ref={notificationPanelRef} className="relative inline-block">
              <Button
                variant="outline"
                size="sm"
                aria-haspopup="listbox"
                aria-expanded={notificationPanelOpen}
                onClick={() => setNotificationPanelOpen((prev) => !prev)}
                className="h-9 w-9 rounded-[10px] border-[var(--border)] p-0"
              >
                <span className="relative inline-flex h-9 w-9 items-center justify-center">
                  <Bell size={15} />
                  {unreadCount > 0 ? (
                    <span className={notificationTokens.badge + " absolute -right-0.5 -top-0.5"}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </span>
              </Button>
              {notificationPanelOpen && (
                <div
                  role="listbox"
                  aria-label="Notifications"
                  className="absolute right-0 top-full z-50 mt-1"
                >
                  <NotificationPanel>
                    {notificationsLoading ? (
                      <NotificationLoadingState />
                    ) : notifications.length === 0 ? (
                      <NotificationEmptyState />
                    ) : (
                      notifications.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onClick={() => void handleNotificationSelect(notification)}
                        />
                      ))
                    )}
                  </NotificationPanel>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="glass-field inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--muted-text)] cursor-default opacity-50"
              aria-label="Notifications unavailable"
              title="Notifications unavailable"
              disabled
            >
              <Bell size={15} />
            </button>
          )}
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
