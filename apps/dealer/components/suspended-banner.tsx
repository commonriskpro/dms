"use client";

import * as React from "react";
import { useDealerLifecycle } from "@/contexts/dealer-lifecycle-context";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dashboardTokens } from "@/lib/ui/tokens";

function ReadOnlyHelp({ reason }: { reason?: string | null }) {
  return (
    <>
      <p className="text-sm text-[var(--text)]">
        Read-only mode: writes are disabled; you can view data only.
      </p>
      {reason && reason.trim() && (
        <p className="mt-2 text-sm text-[var(--text)] font-medium">
          Reason: {reason.trim()}
        </p>
      )}
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Your dealership is currently suspended. You can browse inventory, deals, and other records, but create, edit, and delete actions are disabled until the suspension is lifted. Contact support if you have questions.
      </p>
    </>
  );
}

export function SuspendedBanner() {
  const { isSuspended, lastStatusReason } = useDealerLifecycle();
  const [helpOpen, setHelpOpen] = React.useState(false);

  if (!isSuspended) return null;

  return (
    <>
      <div
        role="alert"
        className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border-b ${dashboardTokens.warningMuted} ${dashboardTokens.warningMutedFg} border-[var(--warning)]`}
      >
        <span>
          This dealership is suspended. You can view records but cannot make changes.
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setHelpOpen(true)}
          className="ml-2 font-medium underline underline-offset-2 hover:no-underline"
          aria-label="Learn more about read-only mode"
        >
          Learn more
        </Button>
      </div>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogHeader>
          <DialogTitle>Read-only mode</DialogTitle>
          <DialogDescription>Why some actions are disabled</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <ReadOnlyHelp reason={lastStatusReason} />
        </div>
        <DialogFooter>
          <DialogClose className="inline-flex justify-center font-medium border px-4 py-2 text-sm rounded-md bg-[var(--muted)] text-[var(--text)] hover:bg-[var(--muted)]/80 border-[var(--border)]">
            Close
          </DialogClose>
        </DialogFooter>
      </Dialog>
    </>
  );
}
