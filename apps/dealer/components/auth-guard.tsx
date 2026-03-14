"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/contexts/session-context";

const PROTECTED_PREFIXES = ["/admin", "/files", "/inventory", "/deals", "/pending", "/closed", "/dashboard", "/customers", "/crm", "/lenders", "/vendors", "/reports", "/sales"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, activeDealership, pendingApproval, lifecycleStatus, closedDealership } = useSession();

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname?.startsWith(p));
  const isLogin = pathname === "/login";
  const isGetStarted = pathname === "/get-started";
  const isPending = pathname === "/pending";
  const isClosedPage = pathname === "/closed";

  React.useEffect(() => {
    if (state.status === "loading") return;

    if (state.status === "authenticated" && (lifecycleStatus === "CLOSED" || closedDealership) && !isClosedPage) {
      router.replace("/closed");
      return;
    }

    if (isProtected) {
      if (state.status !== "authenticated") {
        router.replace("/login");
        return;
      }
      if (!activeDealership && !closedDealership && !isGetStarted && !isPending) {
        if (pendingApproval) {
          router.replace("/pending");
        } else {
          router.replace("/get-started");
        }
      }
    }
  }, [state.status, activeDealership, pendingApproval, lifecycleStatus, closedDealership, isProtected, isLogin, isGetStarted, isPending, isClosedPage, router]);

  if (state.status === "loading" && isProtected) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
