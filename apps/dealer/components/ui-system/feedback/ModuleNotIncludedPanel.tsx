"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert } from "@/lib/ui/icons";

/**
 * Shown when the user navigates to a route that requires a module not included in their plan.
 * Use with ModuleGuard or when canAccessModule(entitlements, permissions, moduleKey) is false.
 */
export function ModuleNotIncludedPanel({
  moduleName,
  showSettingsLink = true,
}: {
  /** Human-readable module name (e.g. "Reports") for the message. */
  moduleName?: string;
  /** Whether to show a link to Settings. Default true. */
  showSettingsLink?: boolean;
}) {
  const title = moduleName
    ? `${moduleName} is not included in your plan`
    : "Module not included in your plan";
  const description =
    "Contact your administrator or upgrade your subscription to access this feature.";

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-text)]">
        <CircleAlert size={24} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted-text)]">{description}</p>
      {showSettingsLink && (
        <div className="mt-4">
          <Link
            href="/settings"
            className="inline-flex items-center justify-center font-medium border border-[var(--border)] px-4 py-2 text-sm rounded-md bg-transparent text-[var(--text)] hover:bg-[var(--muted)] transition-colors duration-200 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            Go to Settings
          </Link>
        </div>
      )}
    </div>
  );
}
