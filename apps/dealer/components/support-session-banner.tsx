"use client";

import * as React from "react";
import { useSession } from "@/contexts/session-context";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/http";

export function SupportSessionBanner() {
  const { isSupportSession, activeDealership, refetch } = useSession();
  const [ending, setEnding] = React.useState(false);

  if (!isSupportSession) return null;

  const handleEndSession = async () => {
    setEnding(true);
    try {
      await apiFetch("/api/support-session/end", { method: "POST" });
      await refetch();
      window.location.href = "/";
    } catch {
      setEnding(false);
    }
  };

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm font-medium border-b border-[var(--ring)] bg-[var(--surface)] text-[var(--text)]"
    >
      <span>
        Support session — viewing as <strong>{activeDealership?.name ?? "Dealership"}</strong>. You are not logged in as a dealer user.
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleEndSession}
        disabled={ending}
        className="shrink-0"
      >
        {ending ? "Ending…" : "End support session"}
      </Button>
    </div>
  );
}
