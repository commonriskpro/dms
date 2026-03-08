"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlatformUnverifiedEmailBanner } from "@/components/platform-unverified-email-banner";

const NAV = [
  { href: "/platform", label: "Dashboard" },
  { href: "/platform/applications", label: "Applications" },
  { href: "/platform/dealer-applications", label: "Dealer applications" },
  { href: "/platform/accounts", label: "Accounts" },
  { href: "/platform/dealerships", label: "Dealerships" },
  { href: "/platform/subscriptions", label: "Subscriptions" },
  { href: "/platform/users", label: "Users" },
  { href: "/platform/reports", label: "Reports" },
  { href: "/platform/monitoring", label: "Monitoring" },
  { href: "/platform/audit", label: "Audit Logs" },
  { href: "/platform/billing", label: "Billing" },
  { href: "/platform/account", label: "Account" },
];

export function PlatformShell({
  role,
  userId,
  emailVerified = true,
  children,
}: {
  role: string | null;
  userId: string | null;
  emailVerified?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <PlatformUnverifiedEmailBanner emailVerified={emailVerified} />
      <header className="border-b border-[var(--border)] bg-[var(--panel)] px-4 h-14 flex items-center justify-between shrink-0">
        <span className="font-semibold text-[var(--text)]">Platform Admin</span>
        <div className="flex items-center gap-4">
          {role && (
            <span className="text-sm text-[var(--text-soft)]" title={userId ?? undefined}>
              {role.replace("PLATFORM_", "")}
            </span>
          )}
          <a
            href="/api/platform/auth/logout"
            className="text-sm text-[var(--text-soft)] hover:underline"
            aria-label="Sign out of platform"
          >
            Sign out
          </a>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="w-56 border-r border-[var(--border)] bg-[var(--panel)] p-4 shrink-0">
          <nav className="flex flex-col gap-1">
            {NAV.map(({ href, label }) => {
              const isActive = href === "/platform" ? pathname === "/platform" : pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--muted)] text-[var(--accent)]"
                      : "text-[var(--text-soft)] hover:bg-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 p-6 bg-[var(--bg)] overflow-auto">{children}</main>
      </div>
    </div>
  );
}
