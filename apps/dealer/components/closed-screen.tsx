"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { Button } from "@/components/ui/button";
import { useDealerLifecycle } from "@/contexts/dealer-lifecycle-context";

export function ClosedScreen() {
  const { closedDealership, lastStatusReason } = useDealerLifecycle();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [logoutError, setLogoutError] = React.useState<string | null>(null);

  const handleSwitchDealership = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await apiFetch("/api/auth/logout", { method: "POST", expectNoContent: true });
      router.replace("/login");
    } catch {
      setLogoutError("Unable to sign out right now. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Dealership Closed</h1>
        <p className="text-[var(--text-soft)]">
          {closedDealership
            ? `The dealership "${closedDealership.name}" has been closed. You can no longer access its data or make changes.`
            : "This dealership has been closed. You can no longer access its data or make changes."}
        </p>
        {lastStatusReason && (
          <p className="text-sm text-[var(--text-soft)]">
            Reason: {lastStatusReason}
          </p>
        )}
        <p className="text-sm text-[var(--text-soft)]">
          If you believe this is an error or need to access another dealership, please contact support or switch dealership below.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 justify-center">
        <Button
          onClick={handleSwitchDealership}
          disabled={loggingOut}
          className="bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
        >
          {loggingOut ? "Switching…" : "Sign out & switch dealership"}
        </Button>
        <a
          href="mailto:support@example.com"
          className="inline-flex justify-center font-medium border px-4 py-2 text-sm rounded-md bg-[var(--muted)] text-[var(--text)] hover:bg-slate-200 border-[var(--border)]"
        >
          Contact support
        </a>
      </div>
      {logoutError && <p className="text-sm text-[var(--danger)]">{logoutError}</p>}
    </main>
  );
}
