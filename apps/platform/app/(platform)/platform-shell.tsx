"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/platform/applications", label: "Applications" },
  { href: "/platform/dealerships", label: "Dealerships" },
  { href: "/platform/users", label: "Users" },
  { href: "/platform/audit", label: "Audit Logs" },
  { href: "/platform/monitoring", label: "Monitoring" },
];

export function PlatformShell({
  role,
  userId,
  children,
}: {
  role: string | null;
  userId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
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
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname?.startsWith(href)
                    ? "bg-[var(--muted)] text-[var(--accent)]"
                    : "text-[var(--text-soft)] hover:bg-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6 bg-[var(--bg)] overflow-auto">{children}</main>
      </div>
    </div>
  );
}
