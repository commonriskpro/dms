"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Paths unauthenticated users may access. /platform/bootstrap is not listed: unauthenticated users are redirected to login. */
const ALLOWED_PATHS = ["/platform/login", "/platform/forgot-password", "/platform/reset-password"];

export function PlatformAuthRedirect({
  children,
  redirectTo = "/platform/login",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    const allowed = ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!allowed) {
      router.replace(redirectTo);
    }
  }, [pathname, redirectTo, router]);

  if (!pathname) return null;
  const allowed = ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}
