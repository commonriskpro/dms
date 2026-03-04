"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const BOOTSTRAP_PATH = "/platform/bootstrap";
const FORBIDDEN_PATH = "/platform/forbidden";

export function ForbiddenOrBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isBootstrap = pathname === BOOTSTRAP_PATH;
  const isForbiddenPage = pathname === FORBIDDEN_PATH;

  useEffect(() => {
    if (!pathname) return;
    if (isBootstrap || isForbiddenPage) return;
    router.replace(FORBIDDEN_PATH);
  }, [pathname, isBootstrap, isForbiddenPage, router]);

  if (isBootstrap) {
    return <>{children}</>;
  }

  if (isForbiddenPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-6 py-8 text-center max-w-md">
        <h1 className="text-xl font-semibold text-[var(--text)]">Not authorized</h1>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Your account is not authorized to access the platform admin. Contact your administrator.
        </p>
        <a
          href="/api/platform/auth/logout"
          className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline"
        >
          Sign out
        </a>
      </div>
    </div>
  );
}
