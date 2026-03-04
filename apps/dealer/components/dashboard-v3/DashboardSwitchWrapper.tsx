"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { apiFetch } from "@/lib/client/http";

/**
 * Handles ?switchDealership=uuid redirect after invite; then renders children.
 * No fetch-on-mount for dashboard data (data comes from server via initialData).
 */
export function DashboardSwitchWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, refetch } = useSession();
  const switchDealershipId = searchParams.get("switchDealership");
  const hasSwitchedRef = React.useRef(false);

  React.useEffect(() => {
    if (state.status !== "authenticated" || !switchDealershipId || hasSwitchedRef.current) return;
    hasSwitchedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        await apiFetch("/api/auth/session/switch", {
          method: "PATCH",
          body: JSON.stringify({ dealershipId: switchDealershipId }),
        });
        if (!cancelled) {
          await refetch();
          router.replace("/dashboard", { scroll: false });
        }
      } catch {
        hasSwitchedRef.current = false;
        if (!cancelled) router.replace("/dashboard", { scroll: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.status, switchDealershipId, refetch, router]);

  return <>{children}</>;
}
