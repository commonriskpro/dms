"use client";

import * as React from "react";
import Link from "next/link";
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryFallbackProps {
  /** Called when the user clicks Retry. In route error.tsx this is Next.js reset(). */
  onRetry?: () => void;
  /** Optional dashboard href. Defaults to /dashboard. */
  dashboardHref?: string;
}

/**
 * Standardized error fallback UI. Use in React error boundaries or Next.js error.tsx.
 * Token colors only; uses DMSCard.
 */
export function ErrorBoundaryFallback({
  onRetry,
  dashboardHref = "/dashboard",
}: ErrorBoundaryFallbackProps): React.ReactElement {
  return (
    <div
      className="flex min-h-[min(60vh,400px)] flex-col items-center justify-center p-6"
      role="alert"
      aria-live="assertive"
    >
      <DMSCard className="w-full max-w-md">
        <DMSCardHeader>
          <DMSCardTitle className="text-[var(--text)]">
            Something went wrong
          </DMSCardTitle>
        </DMSCardHeader>
        <DMSCardContent className="space-y-4">
          <p className="text-sm text-[var(--muted-text)]">
            The page encountered an unexpected error.
          </p>
          <div className="flex flex-wrap gap-2">
            {onRetry != null && (
              <Button type="button" variant="primary" onClick={onRetry}>
                Retry
              </Button>
            )}
            <Link
              href={dashboardHref}
              className="glass-field inline-flex items-center justify-center rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--glass-bg-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0"
            >
              Go to Dashboard
            </Link>
          </div>
        </DMSCardContent>
      </DMSCard>
    </div>
  );
}
